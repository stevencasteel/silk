import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
  TransformComponent,
  SilkComponent,
  TraversalStateComponent,
  KinematicTargetComponent
} from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";
import * as BABYLON from "@babylonjs/core";

export class PlayerAnimationSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;

  constructor(
    private refs: EntityRefs,
    private transforms: ComponentStore<TransformComponent>,
    private silks: ComponentStore<SilkComponent>,
    private traversal: ComponentStore<TraversalStateComponent>,
    private targets: ComponentStore<KinematicTargetComponent>
  ) {}

  public update(dt: number): void {
    const pTrans = this.transforms.get(this.refs.player);
    const silk = this.silks.get(this.refs.player);
    const trav = this.traversal.get(this.refs.player);
    const target = this.targets.get(this.refs.player);

    if (!pTrans || !silk || !trav || !target) return;

    if (pTrans.scaleX === undefined || pTrans.scaleY === undefined || pTrans.scaleZ === undefined || pTrans.prevScaleX === undefined || pTrans.prevScaleY === undefined || pTrans.prevScaleZ === undefined) {
      pTrans.scaleX = 1.0;
      pTrans.scaleY = 1.0;
      pTrans.scaleZ = 1.0;
      pTrans.prevScaleX = 1.0;
      pTrans.prevScaleY = 1.0;
      pTrans.prevScaleZ = 1.0;
    }
    pTrans.prevScaleX = pTrans.scaleX;
    pTrans.prevScaleY = pTrans.scaleY;
    pTrans.prevScaleZ = pTrans.scaleZ;

    const tuning = GAMEPLAY_TUNING.PLAYER;

    let targetScaleX: number;
    let targetScaleY: number;
    let targetScaleZ: number;

    if (trav.state === "LAUNCHING") {
      const stretchFactor = tuning.SQUASH_STRETCH.LAUNCH_POWER_MULT * trav.launchPower;
      targetScaleY = 1.0 + stretchFactor;
      targetScaleX = 1.0 - stretchFactor * 0.5;
      targetScaleZ = 1.0 - stretchFactor * 0.5;
    } else if (trav.state === "WALL_SLIDING") {
      targetScaleX = tuning.SQUASH_STRETCH.WALL_SLIDE_X;
      targetScaleY = tuning.SQUASH_STRETCH.WALL_SLIDE_Y;
      targetScaleZ = tuning.SQUASH_STRETCH.WALL_SLIDE_Z;
    } else {
      const speed = Math.sqrt(silk.dynamicVelX * silk.dynamicVelX + silk.dynamicVelY * silk.dynamicVelY);
      const stretchFactor = Math.min(
        tuning.SQUASH_STRETCH.AIRBORNE_STRETCH_MAX,
        (speed / tuning.SQUASH_STRETCH.AIRBORNE_SPEED_BASIS) * tuning.SQUASH_STRETCH.AIRBORNE_STRETCH_MAX
      );
      targetScaleY = 1.0 + stretchFactor;
      targetScaleX = 1.0 - stretchFactor * 0.5;
      targetScaleZ = 1.0 - stretchFactor * 0.5;
    }

    const sx = pTrans.scaleX ?? 1.0;
    const sy = pTrans.scaleY ?? 1.0;
    const sz = pTrans.scaleZ ?? 1.0;

    pTrans.scaleX = sx + (targetScaleX - sx) * tuning.SCALE_INTERP_RATE * dt;
    pTrans.scaleY = sy + (targetScaleY - sy) * tuning.SCALE_INTERP_RATE * dt;
    pTrans.scaleZ = sz + (targetScaleZ - sz) * tuning.SCALE_INTERP_RATE * dt;

    let rotDx = 0;
    let rotDy = 1;

    if (trav.state === "LAUNCHING") {
      const vx = silk.dynamicVelX;
      const vy = silk.dynamicVelY;
      if (vx * vx + vy * vy > 1.0) {
        rotDx = vx;
        rotDy = vy;
      }
    } else if (trav.state === "AIRBORNE") {
      rotDx = target.x - silk.anchorX;
      rotDy = target.y - silk.anchorY;
    }

    const targetAngle = rotDx !== 0 || rotDy !== 1 ? -Math.atan2(rotDx, rotDy) : 0;
    const targetQuat = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, targetAngle);

    const currentQuat = new BABYLON.Quaternion(pTrans.qx, pTrans.qy, pTrans.qz, pTrans.qw);

    BABYLON.Quaternion.SlerpToRef(currentQuat, targetQuat, tuning.SLERP_FACTOR, currentQuat);

    pTrans.qx = currentQuat.x;
    pTrans.qy = currentQuat.y;
    pTrans.qz = currentQuat.z;
    pTrans.qw = currentQuat.w;
  }
}
