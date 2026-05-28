import { solveScaleSpring } from "../../core/utils/EngineUtils";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  KinematicVelocityComponent,
  WeaverTraversalComponent,
  TransformComponent,
  KinematicTargetComponent,
  WeaverAIComponent,
  HealthComponent,
  WeaverSweepComponent
} from "../../core/ecs/Components";
import { ARENA_CONFIG, WEAVER_AI_TUNING } from "../../core/engine/ArenaConfig";
import { GameEvent } from "../../core/events/GameEvents";
import * as BABYLON from "@babylonjs/core";

export class WeaverTraversalSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;

  private readonly _targetQuat = new BABYLON.Quaternion();
  private readonly _currentQuat = new BABYLON.Quaternion();
  private readonly _raycastResult = new BABYLON.PhysicsRaycastResult();
  private readonly _rayStart = new BABYLON.Vector3();
  private readonly _rayEnd = new BABYLON.Vector3();

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
    const sweepStore = this.context.stores.get<WeaverSweepComponent>("weaverSweep");

    if (!vel || !trav || !trans || !target) return;

    const isStriking = ai && ai.state === "STRIKING";
    const isPatrolling = ai && ai.state === "PATROLLING";
    let sState = sweepStore.get(this.context.refs.weaver);

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
        sweepStore.add(this.context.refs.weaver, sState);
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

        if (concreteEngine && Math.abs(vel.x) > 0.001) {
          this._rayStart.set(trans.x, trans.y, 0);
          const castLength =
            ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.1, Math.abs(vel.x) * dt);
          this._rayEnd.set(trans.x + sState.direction * castLength, trans.y, 0);

          concreteEngine.raycastToRef(this._rayStart, this._rayEnd, this._raycastResult);

          if (this._raycastResult.hasHit && this._raycastResult.body) {
            const hitDistance = this._raycastResult.hitDistance;
            if (
              hitDistance <=
              ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.01, Math.abs(vel.x) * dt)
            ) {
              hitWallNormal = Math.sign(this._raycastResult.hitNormalWorld.x);
              nextX =
                this._raycastResult.hitPointWorld.x -
                sState.direction * ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
            }
          }
        } else {
          const fallbackLimit =
            ARENA_CONFIG.HORIZONTAL.PLAY_AREA_HALF_WIDTH - ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
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

          trans.scaleVelX! += -3.5;
          trans.scaleVelY! += 2.5;
          trans.scaleVelZ! += 2.5;

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

          trans.scaleVelX! += 4.5;
          trans.scaleVelY! += -3.5;
          trans.scaleVelZ! += -3.5;
        }

        target.y = ARENA_CONFIG.VERTICAL.WEAVER_CEILING_Y;
        target.active = true;
      }
    } else {
      target.x = trans.x + vel.x * dt;
      target.y = trans.y + vel.y * dt;
      target.active = true;
      sweepStore.remove(this.context.refs.weaver);
    }

    let isGrounded = false;
    let isWallClinging = false;
    let wallNormalX = 0;

    if (concreteEngine) {
      if (Math.abs(vel.x) > 0.01) {
        this._rayStart.set(trans.x, target.y, 0);
        const dirX = Math.sign(vel.x);
        const castLength = ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.1, Math.abs(vel.x) * dt);
        this._rayEnd.set(trans.x + dirX * castLength, target.y, 0);

        concreteEngine.raycastToRef(this._rayStart, this._rayEnd, this._raycastResult);

        if (this._raycastResult.hasHit && this._raycastResult.body) {
          const hitDistance = this._raycastResult.hitDistance;
          if (
            hitDistance <=
            ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.01, Math.abs(vel.x) * dt)
          ) {
            target.x =
              this._raycastResult.hitPointWorld.x - dirX * ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
            if (vel.x * dirX > 0) vel.x = 0;
          }
        }
      }

      this._rayStart.set(target.x, trans.y, 0);
      const castLengthDown =
        ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.1, Math.max(0, -vel.y) * dt);
      this._rayEnd.set(target.x, trans.y - castLengthDown, 0);

      concreteEngine.raycastToRef(this._rayStart, this._rayEnd, this._raycastResult);

      if (this._raycastResult.hasHit && this._raycastResult.body && !isStriking) {
        const hitDistance = this._raycastResult.hitDistance;
        if (
          hitDistance <=
          ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.01, Math.max(0, -vel.y) * dt)
        ) {
          isGrounded = true;
          target.y = this._raycastResult.hitPointWorld.y + ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
          if (vel.y < 0) vel.y = 0;
        }
      }

      const wallCheckDist = ARENA_CONFIG.ENTITY.WEAVER_RADIUS + 0.15;
      this._rayStart.set(target.x, target.y, 0);

      this._rayEnd.set(target.x - wallCheckDist, target.y, 0);
      concreteEngine.raycastToRef(this._rayStart, this._rayEnd, this._raycastResult);

      if (this._raycastResult.hasHit && this._raycastResult.body) {
        isWallClinging = true;
        wallNormalX = 1;
      } else {
        this._rayEnd.set(target.x + wallCheckDist, target.y, 0);
        concreteEngine.raycastToRef(this._rayStart, this._rayEnd, this._raycastResult);
        if (this._raycastResult.hasHit && this._raycastResult.body) {
          isWallClinging = true;
          wallNormalX = -1;
        }
      }
    } else {
      const wallLimitFallback =
        ARENA_CONFIG.HORIZONTAL.PLAY_AREA_HALF_WIDTH - ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
      if (target.x > wallLimitFallback && (!sState || sState.phase !== "HOLD")) {
        target.x = wallLimitFallback;
        if (vel.x > 0) vel.x = 0;
      } else if (target.x < -wallLimitFallback && (!sState || sState.phase !== "HOLD")) {
        target.x = -wallLimitFallback;
        if (vel.x < 0) vel.x = 0;
      }

      const ceilingLimit = ARENA_CONFIG.VERTICAL.CEILING_Y;
      const floorLimit = isStriking
        ? ARENA_CONFIG.VERTICAL.FLOOR_Y - 70.0
        : ARENA_CONFIG.VERTICAL.FLOOR_Y;
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
      trans.prevScaleX = trans.scaleX!;
      trans.prevScaleY = trans.scaleY!;
      trans.prevScaleZ = trans.scaleZ!;

      let targetScaleX = 1.0;
      let targetScaleY = 1.0;
      let targetScaleZ = 1.0;

      this._targetQuat.set(0, 0, 0, 1);

      if (ai) {
        if (ai.state === "DEFEATED") {
          targetScaleX = WEAVER_AI_TUNING.DEFEATED.SCALE;
          targetScaleY = WEAVER_AI_TUNING.DEFEATED.SCALE;
          targetScaleZ = WEAVER_AI_TUNING.DEFEATED.SCALE;
          BABYLON.Quaternion.RotationYawPitchRollToRef(0, 0, 0, this._targetQuat);
        } else if (trav.isWallClinging) {
          const breath = ai.state === "PATROLLING" ? Math.sin(ai.timeInState * 10.0) * 0.015 : 0.0;
          targetScaleX = 0.75 + breath;
          targetScaleY = 1.15 - breath * 0.5;
          targetScaleZ = 1.15 - breath * 0.5;
          BABYLON.Quaternion.RotationYawPitchRollToRef(0, 0, 0, this._targetQuat);
        } else if (trav.isGrounded) {
          targetScaleY = 0.75;
          targetScaleX = 1.15;
          targetScaleZ = 1.15;
          BABYLON.Quaternion.RotationYawPitchRollToRef(0, 0, 0, this._targetQuat);
        } else {
          if (ai.state === "PATROLLING") {
            const pulse =
              Math.sin(ai.timeInState * WEAVER_AI_TUNING.ANIMATION.PULSE_FREQ) *
              WEAVER_AI_TUNING.ANIMATION.PULSE_BASE;
            targetScaleX = 1.0 + pulse;
            targetScaleY = 1.0 - pulse;

            const rollAngle = -vel.x * WEAVER_AI_TUNING.ANIMATION.ROLL_ANGLE_SCALE;
            const MathAngle =
              Math.sin(ai.timeInState * WEAVER_AI_TUNING.ANIMATION.YAW_PITCH_ROLL_FREQ) *
              WEAVER_AI_TUNING.ANIMATION.YAW_PITCH_ROLL_AMP;
            BABYLON.Quaternion.RotationYawPitchRollToRef(MathAngle, 0, rollAngle, this._targetQuat);
          } else if (ai.state === "STRIKING") {
            const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
            if (speed < WEAVER_AI_TUNING.DASH.SPEED_THRESHOLD) {
              targetScaleY = WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.PREP_Y;
              targetScaleX = WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.PREP_X;
              targetScaleZ = WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.PREP_Z;

              const wobbleFreq = 12.0;
              const wobbleAmp =
                0.08 * Math.max(0.0, 1.0 - ai.timeInState / WEAVER_AI_TUNING.DASH.PREP_TIME);
              const wobbleAngle = Math.sin(ai.timeInState * wobbleFreq) * Math.max(0.02, wobbleAmp);
              BABYLON.Quaternion.RotationYawPitchRollToRef(0, 0, wobbleAngle, this._targetQuat);
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
              BABYLON.Quaternion.RotationAxisToRef(BABYLON.Axis.Z, angle, this._targetQuat);
            }
          } else if (ai.state === "ASCENDING") {
            targetScaleY = WEAVER_AI_TUNING.RETURN.SQUASH_STRETCH.Y;
            targetScaleX = WEAVER_AI_TUNING.RETURN.SQUASH_STRETCH.X;
            BABYLON.Quaternion.RotationYawPitchRollToRef(0, 0, 0, this._targetQuat);
          }
        }
      }

      solveScaleSpring(trans, targetScaleX, targetScaleY, targetScaleZ, dt, 120, 22);

      this._currentQuat.set(trans.qx, trans.qy, trans.qz, trans.qw);
      BABYLON.Quaternion.SlerpToRef(
        this._currentQuat,
        this._targetQuat,
        WEAVER_AI_TUNING.ANIMATION.LERP_RATE * dt,
        this._currentQuat
      );
      trans.qx = this._currentQuat.x;
      trans.qy = this._currentQuat.y;
      trans.qz = this._currentQuat.z;
      trans.qw = this._currentQuat.w;

      if (isPatrolling && sState && sState.phase === "HOLD") {
        target.x = sState.direction * (ARENA_CONFIG.ENTITY.WEAVER_RADIUS * trans.scaleX! - 15.0);
      }
    }
  }
}
