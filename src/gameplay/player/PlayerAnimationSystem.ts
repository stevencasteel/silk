import { solveScaleSpring } from "../../core/utils/EngineUtils";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { TransformComponent, PlayerCosmeticComponent } from "../../core/ecs/Components";
import * as BABYLON from "@babylonjs/core";

export class PlayerAnimationSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;

  private readonly _currentQuat = new BABYLON.Quaternion();
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

    BABYLON.Quaternion.RotationAxisToRef(BABYLON.Axis.Z, cosmetic.rotationAngle, this._targetQuat);

    this._currentQuat.set(pTrans.qx, pTrans.qy, pTrans.qz, pTrans.qw);

    BABYLON.Quaternion.SlerpToRef(
      this._currentQuat,
      this._targetQuat,
      cosmetic.slerpFactor,
      this._currentQuat
    );

    pTrans.qx = this._currentQuat.x;
    pTrans.qy = this._currentQuat.y;
    pTrans.qz = this._currentQuat.z;
    pTrans.qw = this._currentQuat.w;
  }
}
