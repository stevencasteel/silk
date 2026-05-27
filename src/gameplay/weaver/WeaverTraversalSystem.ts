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
import * as BABYLON from "@babylonjs/core";

export class WeaverTraversalSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;
  private minX = -(15.0 - ARENA_CONFIG.ENTITY.WEAVER_RADIUS);
  private maxX = 15.0 - ARENA_CONFIG.ENTITY.WEAVER_RADIUS;

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

    const isSweeping = !ai || ai.state === "SWEEPING";
    if (isSweeping) {
      let nextX = trans.x + vel.x * dt;
      const isBerserk = health
        ? health.current < health.max * WEAVER_AI_TUNING.BERSERK_HP_THRESHOLD
        : false;
      const sweepSpeed = isBerserk
        ? WEAVER_AI_TUNING.PATROL.SPEED_BERSERK
        : WEAVER_AI_TUNING.PATROL.SPEED_NORMAL;
      if (nextX >= this.maxX) {
        nextX = this.maxX;
        vel.x = -sweepSpeed;
      } else if (nextX <= this.minX) {
        nextX = this.minX;
        vel.x = sweepSpeed;
      }
      target.x = nextX;
      target.y = ARENA_CONFIG.VERTICAL.WEAVER_CEILING_Y;
      target.active = true;
    } else {
      target.x = trans.x + vel.x * dt;
      target.y = trans.y + vel.y * dt;
      target.active = true;
    }

    const wallLimit = 15.0 - ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
    if (target.x > wallLimit) {
      target.x = wallLimit;
      if (vel.x > 0) vel.x = 0;
    } else if (target.x < -wallLimit) {
      target.x = -wallLimit;
      if (vel.x < 0) vel.x = 0;
    }

    const ceilingLimit = ARENA_CONFIG.VERTICAL.CEILING_Y;
    const floorLimit = ARENA_CONFIG.VERTICAL.FLOOR_Y;
    if (target.y > ceilingLimit) {
      target.y = ceilingLimit;
      if (vel.y > 0) vel.y = 0;
      trav.isGrounded = false;
      trav.isWallClinging = false;
    } else if (target.y < floorLimit) {
      target.y = floorLimit;
      if (vel.y < 0) vel.y = 0;
      trav.isGrounded = true;
      trav.isWallClinging = false;
    } else {
      trav.isGrounded = false;
      const wallThreshold = wallLimit - 0.2;
      if (Math.abs(target.x) >= wallThreshold) {
        trav.isWallClinging = true;
        trav.wallNormalX = target.x > 0 ? -1 : 1;
      } else {
        trav.isWallClinging = false;
        trav.wallNormalX = 0;
      }
    }

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
        if (ai.state === "SWEEPING") {
          const pulse =
            Math.sin(ai.timeInState * WEAVER_AI_TUNING.ANIMATION.PULSE_FREQ) *
            WEAVER_AI_TUNING.ANIMATION.PULSE_BASE;
          targetScaleX = 1.0 + pulse;
          targetScaleY = 1.0 - pulse;

          const boundaryX = 15.0 - ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
          const distToLeft = Math.abs(trans.x - (-boundaryX));
          const distToRight = Math.abs(trans.x - boundaryX);
          const minDist = Math.min(distToLeft, distToRight);

          if (minDist < 2.0) {
            const squishFactor = minDist / 2.0;
            const squishedX = 0.55 + squishFactor * 0.45;
            const stretchedY = 1.35 - squishFactor * 0.35;
            targetScaleX = squishedX;
            targetScaleY = stretchedY;
            targetScaleZ = stretchedY;
          }

          const rollAngle = -vel.x * WEAVER_AI_TUNING.ANIMATION.ROLL_ANGLE_SCALE;
          const yawAngle =
            Math.sin(ai.timeInState * WEAVER_AI_TUNING.ANIMATION.YAW_PITCH_ROLL_FREQ) *
            WEAVER_AI_TUNING.ANIMATION.YAW_PITCH_ROLL_AMP;
          BABYLON.Quaternion.RotationYawPitchRollToRef(yawAngle, 0, rollAngle, targetQuat);
        } else if (ai.state === "DASHING") {
          const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
          if (speed < WEAVER_AI_TUNING.DASH.SPEED_THRESHOLD) {
            if (trav.isWallClinging) {
              targetScaleX = 0.38;
              targetScaleY = 1.55;
              targetScaleZ = 1.55;
            } else if (trav.isGrounded) {
              targetScaleY = 0.38;
              targetScaleX = 1.55;
              targetScaleZ = 1.55;
            } else {
              targetScaleY = WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.PREP_Y;
              targetScaleX = WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.PREP_X;
              targetScaleZ = WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.PREP_Z;
            }

          // Hornet windup shiver wobble along Z (roll)
          const wobbleFreq = 65.0;
          const wobbleAmp = 0.15 * Math.max(0.0, 1.0 - ai.timeInState / WEAVER_AI_TUNING.DASH.PREP_TIME);
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
        } else if (ai.state === "RETURNING") {
          targetScaleY = WEAVER_AI_TUNING.RETURN.SQUASH_STRETCH.Y;
          targetScaleX = WEAVER_AI_TUNING.RETURN.SQUASH_STRETCH.X;
          BABYLON.Quaternion.RotationYawPitchRollToRef(0, 0, 0, targetQuat);
        } else if (ai.state === "DEFEATED") {
          targetScaleX = WEAVER_AI_TUNING.DEFEATED.SCALE;
          targetScaleY = WEAVER_AI_TUNING.DEFEATED.SCALE;
          targetScaleZ = WEAVER_AI_TUNING.DEFEATED.SCALE;
          BABYLON.Quaternion.RotationYawPitchRollToRef(0, 0, 0, targetQuat);
        }
      }

      if (trans.scaleVelX === undefined) trans.scaleVelX = 0;
      if (trans.scaleVelY === undefined) trans.scaleVelY = 0;
      if (trans.scaleVelZ === undefined) trans.scaleVelZ = 0;

      const stiffness = 220;
      const damping = 12;

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
    }
  }
}
