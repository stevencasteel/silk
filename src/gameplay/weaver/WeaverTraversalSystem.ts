import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  KinematicVelocityComponent,
  WeaverTraversalComponent,
  TransformComponent,
  KinematicTargetComponent,
  WeaverAIComponent,
  HealthComponent
} from "../../core/ecs/Components";
import { ARENA_CONFIG, WEAVER_AI_TUNING } from "../../core/engine/ArenaConfig";
import { GameEvent } from "../../core/events/GameEvents";
import * as BABYLON from "@babylonjs/core";

type SweepPhase = "SWEEP" | "HOLD" | "LAUNCH";

interface SweepState {
  phase: SweepPhase;
  timer: number;
  direction: number;
}

export class WeaverTraversalSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;
  private sweepStates = new Map<number, SweepState>();

  constructor(private context: SystemContext) {}

  public update(dt: number): void {
    const vel = this.context.stores
      .get<KinematicVelocityComponent>("velocity")
      .get(this.context.refs.weaver);
    const trav = this.context.stores
      .get<WeaverTraversalComponent>("weaverTraversal")
      .get(this.context.refs.weaver);
    const trans = this.context.stores
      .get<TransformComponent>("transform")
      .get(this.context.refs.weaver);
    const target = this.context.stores
      .get<KinematicTargetComponent>("target")
      .get(this.context.refs.weaver);
    const ai = this.context.stores.get<WeaverAIComponent>("weaverAI").get(this.context.refs.weaver);
    const health = this.context.stores.get<HealthComponent>("health").get(this.context.refs.weaver);

    if (!vel || !trav || !trans || !target) return;

  const isStriking = ai && ai.state === "STRIKING";

    const isPatrolling = ai && ai.state === "PATROLLING";
    let sState = this.sweepStates.get(this.context.refs.weaver);

    const scene = this.context.visualRegistry.getScene();
    const physicsEngine = scene?.getPhysicsEngine();
    const concreteEngine = physicsEngine ? (physicsEngine as BABYLON.PhysicsEngine) : null;

    if (isPatrolling) {
      const isBerserk = health
        ? health.current < health.max * WEAVER_AI_TUNING.BERSERK_HP_THRESHOLD
        : false;
      const sweepSpeed = isBerserk
        ? WEAVER_AI_TUNING.PATROL.SPEED_BERSERK
        : WEAVER_AI_TUNING.PATROL.SPEED_NORMAL;

      if (!sState) {
        const dir = vel.x >= 0 ? 1 : -1;
        sState = {
          phase: "SWEEP",
          timer: 0.0,
          direction: dir
        };
        this.sweepStates.set(this.context.refs.weaver, sState);
      }

      if (sState.phase === "SWEEP" || sState.phase === "LAUNCH") {
        if (sState.phase === "SWEEP") {
          vel.x = sState.direction * sweepSpeed;
        } else {
          const targetVel = sState.direction * sweepSpeed;
          vel.x = vel.x + (targetVel - vel.x) * 5.0 * dt;
        }

        let nextX = trans.x + vel.x * dt;
        let hitWallNormal = 0;

        // Perform live raycast instead of math limits
        if (concreteEngine && Math.abs(vel.x) > 0.001) {
          const raycastResult = new BABYLON.PhysicsRaycastResult();
          const start = new BABYLON.Vector3(trans.x, trans.y, 0);
          const castLength = ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.1, Math.abs(vel.x) * dt);
          const end = new BABYLON.Vector3(trans.x + sState.direction * castLength, trans.y, 0);

          concreteEngine.raycastToRef(start, end, raycastResult);

          if (raycastResult.hasHit && raycastResult.body) {
            const hitDistance = raycastResult.hitDistance;
            if (hitDistance <= ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.01, Math.abs(vel.x) * dt)) {
              hitWallNormal = Math.sign(raycastResult.hitNormalWorld.x);
              nextX = raycastResult.hitPointWorld.x - sState.direction * ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
            }
          }
        } else {
          // Fallback if physics is disabled
          const fallbackLimit = 15.0 - ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
          if (nextX >= fallbackLimit) {
            nextX = fallbackLimit;
            hitWallNormal = -1;
          } else if (nextX <= -fallbackLimit) {
            nextX = -fallbackLimit;
            hitWallNormal = 1;
          }
        }

        if (hitWallNormal !== 0) {
          this.context.broker.publish(GameEvent.WEAVER_WALL_HIT, {
            x: nextX,
            y: trans.y,
            wallNormalX: hitWallNormal
          });

          if (trans.scaleVelX === undefined) trans.scaleVelX = 0;
          if (trans.scaleVelY === undefined) trans.scaleVelY = 0;
          if (trans.scaleVelZ === undefined) trans.scaleVelZ = 0;

          // Scaled down to gentle realistic values
          trans.scaleVelX += -3.5;
          trans.scaleVelY += 2.5;
          trans.scaleVelZ += 2.5;

          sState.phase = "HOLD";
          sState.timer = 0.22;
          sState.direction = hitWallNormal;
          vel.x = 0;
        } else if (sState.phase === "LAUNCH") {
          const currentSpeed = Math.abs(vel.x);
          if (currentSpeed <= sweepSpeed * 1.05) {
            sState.phase = "SWEEP";
            vel.x = sState.direction * sweepSpeed;
          }
        }

        target.x = nextX;
        target.y = ARENA_CONFIG.VERTICAL.WEAVER_CEILING_Y;
        target.active = true;

      } else if (sState.phase === "HOLD") {
        sState.timer -= dt;
        vel.x = 0;

        if (sState.timer <= 0) {
          sState.phase = "LAUNCH";
          vel.x = sState.direction * sweepSpeed * 2.0;

          if (trans.scaleVelX === undefined) trans.scaleVelX = 0;
          if (trans.scaleVelY === undefined) trans.scaleVelY = 0;
          if (trans.scaleVelZ === undefined) trans.scaleVelZ = 0;

          // Scaled down to gentle realistic values
          trans.scaleVelX += 4.5;
          trans.scaleVelY += -3.5;
          trans.scaleVelZ += -3.5;
        }

        target.y = ARENA_CONFIG.VERTICAL.WEAVER_CEILING_Y;
        target.active = true;
      }
    } else {
      target.x = trans.x + vel.x * dt;
      target.y = trans.y + vel.y * dt;
      target.active = true;
      this.sweepStates.delete(this.context.refs.weaver);
    }

    // Replace mathematical floor, ceiling, and wall clamps with physical contacts
    let isGrounded = false;
    let isWallClinging = false;
    let wallNormalX = 0;

    if (concreteEngine) {
      // 1. Raycast horizontally to detect wall collision
      if (Math.abs(vel.x) > 0.01) {
        const wallRayResult = new BABYLON.PhysicsRaycastResult();
        const start = new BABYLON.Vector3(trans.x, target.y, 0);
        const dirX = Math.sign(vel.x);
        const castLength = ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.1, Math.abs(vel.x) * dt);
        const end = new BABYLON.Vector3(trans.x + dirX * castLength, target.y, 0);

        concreteEngine.raycastToRef(start, end, wallRayResult);

        if (wallRayResult.hasHit && wallRayResult.body) {
          const hitDistance = wallRayResult.hitDistance;
          if (hitDistance <= ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.01, Math.abs(vel.x) * dt)) {
            target.x = wallRayResult.hitPointWorld.x - dirX * ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
            if (vel.x * dirX > 0) vel.x = 0;
          }
        }
      }

      // 2. Raycast downward to detect floor collision
      const floorRayResult = new BABYLON.PhysicsRaycastResult();
      const startDown = new BABYLON.Vector3(target.x, trans.y, 0);
      const castLengthDown = ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.1, Math.max(0, -vel.y) * dt);
      const endDown = new BABYLON.Vector3(target.x, trans.y - castLengthDown, 0);

      concreteEngine.raycastToRef(startDown, endDown, floorRayResult);

      if (floorRayResult.hasHit && floorRayResult.body && !isStriking) {
        const hitDistance = floorRayResult.hitDistance;
        if (hitDistance <= ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.01, Math.max(0, -vel.y) * dt)) {
          isGrounded = true;
          target.y = floorRayResult.hitPointWorld.y + ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
          if (vel.y < 0) vel.y = 0;
        }
      }

      // 3. Determine general wall clinging state
      const leftRayResult = new BABYLON.PhysicsRaycastResult();
      const rightRayResult = new BABYLON.PhysicsRaycastResult();
      const startCenter = new BABYLON.Vector3(target.x, target.y, 0);
      const wallCheckDist = ARENA_CONFIG.ENTITY.WEAVER_RADIUS + 0.15;

      concreteEngine.raycastToRef(startCenter, new BABYLON.Vector3(target.x - wallCheckDist, target.y, 0), leftRayResult);
      concreteEngine.raycastToRef(startCenter, new BABYLON.Vector3(target.x + wallCheckDist, target.y, 0), rightRayResult);

      if (leftRayResult.hasHit && leftRayResult.body) {
        isWallClinging = true;
        wallNormalX = 1;
      } else if (rightRayResult.hasHit && rightRayResult.body) {
        isWallClinging = true;
        wallNormalX = -1;
      }
    } else {
      // Fallback if physics is disabled
      const wallLimitFallback = 15.0 - ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
      if (target.x > wallLimitFallback && (!sState || sState.phase !== "HOLD")) {
        target.x = wallLimitFallback;
        if (vel.x > 0) vel.x = 0;
      } else if (target.x < -wallLimitFallback && (!sState || sState.phase !== "HOLD")) {
        target.x = -wallLimitFallback;
        if (vel.x < 0) vel.x = 0;
      }

      const ceilingLimit = ARENA_CONFIG.VERTICAL.CEILING_Y;
      const floorLimit = isStriking ? ARENA_CONFIG.VERTICAL.FLOOR_Y - 70.0 : ARENA_CONFIG.VERTICAL.FLOOR_Y;
      if (target.y > ceilingLimit) {
        target.y = ceilingLimit;
        if (vel.y > 0) vel.y = 0;
        isGrounded = false;
        isWallClinging = false;
      } else if (target.y < floorLimit) {
        target.y = floorLimit;
        if (vel.y < 0) vel.y = 0;
        isGrounded = !isStriking;
        isWallClinging = false;
      } else {
        isGrounded = false;
        const wallThreshold = wallLimitFallback - 0.2;
        if (Math.abs(target.x) >= wallThreshold) {
          isWallClinging = true;
          wallNormalX = target.x > 0 ? -1 : 1;
        } else {
          isWallClinging = false;
          wallNormalX = 0;
        }
      }
    }

    trav.isGrounded = isGrounded;
    trav.isWallClinging = isWallClinging;
    trav.wallNormalX = wallNormalX;

    if (trans) {
      if (
        trans.scaleX === undefined ||
        trans.scaleY === undefined ||
        trans.scaleZ === undefined ||
        trans.prevScaleX === undefined ||
        trans.prevScaleY === undefined ||
        trans.prevScaleZ === undefined
      ) {
        trans.scaleX = 1.0;
        trans.scaleY = 1.0;
        trans.scaleZ = 1.0;
        trans.prevScaleX = 1.0;
        trans.prevScaleY = 1.0;
        trans.prevScaleZ = 1.0;
      }
      trans.prevScaleX = trans.scaleX;
      trans.prevScaleY = trans.scaleY;
      trans.prevScaleZ = trans.scaleZ;

      let targetScaleX = 1.0;
      let targetScaleY = 1.0;
      let targetScaleZ = 1.0;

      const targetQuat = new BABYLON.Quaternion();

      if (ai) {
        if (ai.state === "DEFEATED") {
          targetScaleX = WEAVER_AI_TUNING.DEFEATED.SCALE;
          targetScaleY = WEAVER_AI_TUNING.DEFEATED.SCALE;
          targetScaleZ = WEAVER_AI_TUNING.DEFEATED.SCALE;
          BABYLON.Quaternion.RotationYawPitchRollToRef(0, 0, 0, targetQuat);
        } else if (trav.isWallClinging) {
          // Globally squish against the wall whenever in contact across all states
          const breath = ai.state === "PATROLLING" ? Math.sin(ai.timeInState * 10.0) * 0.015 : 0.0;
          targetScaleX = 0.75 + breath;
          targetScaleY = 1.15 - breath * 0.5;
          targetScaleZ = 1.15 - breath * 0.5;
          BABYLON.Quaternion.RotationYawPitchRollToRef(0, 0, 0, targetQuat);
        } else if (trav.isGrounded) {
          // Globally squish against the floor whenever in contact across all states
          targetScaleY = 0.75;
          targetScaleX = 1.15;
          targetScaleZ = 1.15;
          BABYLON.Quaternion.RotationYawPitchRollToRef(0, 0, 0, targetQuat);
        } else {
          // Standard state-based aero scale
          if (ai.state === "PATROLLING") {
            const pulse =
              Math.sin(ai.timeInState * WEAVER_AI_TUNING.ANIMATION.PULSE_FREQ) *
              WEAVER_AI_TUNING.ANIMATION.PULSE_BASE;
            targetScaleX = 1.0 + pulse;
            targetScaleY = 1.0 - pulse;

            const rollAngle = -vel.x * WEAVER_AI_TUNING.ANIMATION.ROLL_ANGLE_SCALE;
            const yawAngle =
              Math.sin(ai.timeInState * WEAVER_AI_TUNING.ANIMATION.YAW_PITCH_ROLL_FREQ) *
              WEAVER_AI_TUNING.ANIMATION.YAW_PITCH_ROLL_AMP;
            BABYLON.Quaternion.RotationYawPitchRollToRef(yawAngle, 0, rollAngle, targetQuat);
          } else if (ai.state === "STRIKING") {
            const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
            if (speed < WEAVER_AI_TUNING.DASH.SPEED_THRESHOLD) {
              targetScaleY = WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.PREP_Y;
              targetScaleX = WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.PREP_X;
              targetScaleZ = WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.PREP_Z;

              const wobbleFreq = 12.0;
              const wobbleAmp = 0.08 * Math.max(0.0, 1.0 - ai.timeInState / WEAVER_AI_TUNING.DASH.PREP_TIME);
              const wobbleAngle = Math.sin(ai.timeInState * wobbleFreq) * Math.max(0.02, wobbleAmp);
              BABYLON.Quaternion.RotationYawPitchRollToRef(0, 0, wobbleAngle, targetQuat);
            } else {
              const stretch = Math.min(
                WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.STRETCH_MAX,
                (speed / WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.STRETCH_SPEED_BASIS) *
                  WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.STRETCH_MAX
              );
              targetScaleY = 1.0 + stretch;
              targetScaleX = 1.0 - stretch * 0.5;
              targetScaleZ = 1.0 - stretch * 0.5;

              const angle = Math.atan2(vel.y, vel.x) + Math.PI / 2;
              BABYLON.Quaternion.RotationAxisToRef(BABYLON.Axis.Z, angle, targetQuat);
            }
          } else if (ai.state === "ASCENDING") {
            targetScaleY = WEAVER_AI_TUNING.RETURN.SQUASH_STRETCH.Y;
            targetScaleX = WEAVER_AI_TUNING.RETURN.SQUASH_STRETCH.X;
            BABYLON.Quaternion.RotationYawPitchRollToRef(0, 0, 0, targetQuat);
          }
        }
      }

      if (trans.scaleVelX === undefined) trans.scaleVelX = 0;
      if (trans.scaleVelY === undefined) trans.scaleVelY = 0;
      if (trans.scaleVelZ === undefined) trans.scaleVelZ = 0;

      // Critically damped mass-spring parameters for ultra-smooth realistic transitions
      const stiffness = 120;
      const damping = 22;

      const dispX = (trans.scaleX ?? 1.0) - targetScaleX;
      const dispY = (trans.scaleY ?? 1.0) - targetScaleY;
      const dispZ = (trans.scaleZ ?? 1.0) - targetScaleZ;

      const accelX = -stiffness * dispX - damping * trans.scaleVelX;
      const accelY = -stiffness * dispY - damping * trans.scaleVelY;
      const accelZ = -stiffness * dispZ - damping * trans.scaleVelZ;

      trans.scaleVelX += accelX * dt;
      trans.scaleVelY += accelY * dt;
      trans.scaleVelZ += accelZ * dt;

      trans.scaleX = (trans.scaleX ?? 1.0) + trans.scaleVelX * dt;
      trans.scaleY = (trans.scaleY ?? 1.0) + trans.scaleVelY * dt;
      trans.scaleZ = (trans.scaleZ ?? 1.0) + trans.scaleVelZ * dt;

      const currentQuat = new BABYLON.Quaternion(trans.qx, trans.qy, trans.qz, trans.qw);
      BABYLON.Quaternion.SlerpToRef(
        currentQuat,
        targetQuat,
        WEAVER_AI_TUNING.ANIMATION.LERP_RATE * dt,
        currentQuat
      );
      trans.qx = currentQuat.x;
      trans.qy = currentQuat.y;
      trans.qz = currentQuat.z;
      trans.qw = currentQuat.w;

      if (isPatrolling && sState && sState.phase === "HOLD") {
        target.x = sState.direction * (ARENA_CONFIG.ENTITY.WEAVER_RADIUS * trans.scaleX - 15.0);
      }
    }
  }
}
