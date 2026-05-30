import { solveScaleSpring, solveSpringDamper } from "../../core/utils/EngineUtils";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { TransformComponent, PlayerCosmeticComponent } from "../../core/ecs/Components";
import * as BABYLON from "@babylonjs/core";

export class PlayerAnimationSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;

  private readonly _targetQuat = new BABYLON.Quaternion();

  constructor(private context: SystemContext) {}

  public update(dt: number): void {
    const pTrans = this.context.stores
      .get<TransformComponent>("transform")
      .get(this.context.refs.player);
    const cosmetic = this.context.stores
      .get<PlayerCosmeticComponent>("playerCosmetic")
      .get(this.context.refs.player);

    if (!pTrans || !cosmetic) return;

    pTrans.prevScaleX = pTrans.scaleX!;
    pTrans.prevScaleY = pTrans.scaleY!;
    pTrans.prevScaleZ = pTrans.scaleZ!;

    solveScaleSpring(
      pTrans,
      cosmetic.targetScaleX,
      cosmetic.targetScaleY,
      cosmetic.targetScaleZ,
      dt,
      cosmetic.springStiffness,
      cosmetic.springDamping
    );

    pTrans.scaleX = Math.max(0.1, pTrans.scaleX!);
    pTrans.scaleY = Math.max(0.1, pTrans.scaleY!);
    pTrans.scaleZ = Math.max(0.1, pTrans.scaleZ!);

    const currentRot = cosmetic.currentRotation ?? 0;
    const rotVel = cosmetic.rotationVel ?? 0;
    const targetRot = cosmetic.rotationAngle;

    let diff = targetRot - currentRot;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const adjustedTarget = currentRot + diff;

    const rotStiffness = 140;
    const rotDamping = 10;

    const result = solveSpringDamper(
      currentRot,
      adjustedTarget,
      rotVel,
      dt,
      rotStiffness,
      rotDamping
    );

    cosmetic.currentRotation = result.value;
    cosmetic.rotationVel = result.velocity;

    BABYLON.Quaternion.RotationAxisToRef(BABYLON.Axis.Z, result.value, this._targetQuat);

    pTrans.qx = this._targetQuat.x;
    pTrans.qy = this._targetQuat.y;
    pTrans.qz = this._targetQuat.z;
    pTrans.qw = this._targetQuat.w;
  }
}
