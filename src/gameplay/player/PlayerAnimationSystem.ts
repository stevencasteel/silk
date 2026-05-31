import { solveScaleSpring, solveSpringDamper, solveSpringDamper as solveOffsetSpring } from "../../core/utils/EngineUtils";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  TransformComponent, PlayerCosmeticComponent,
  KinematicVelocityComponent } from "../../core/ecs/Components";
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
    const velStore = this.context.stores.get<KinematicVelocityComponent>("velocity");
    const vel = velStore.get(this.context.refs.player);
    const speedX = vel ? vel.x : 0.0;
    const speedY = vel ? vel.y : 0.0;
    const speed = Math.sqrt(speedX * speedX + speedY * speedY);

    if (speed > 15.0) {
      const stretch = Math.min(0.85, (speed - 15.0) * 0.015);
      cosmetic.targetScaleY = Math.max(cosmetic.targetScaleY, 1.0 + stretch);
      cosmetic.targetScaleX = Math.min(cosmetic.targetScaleX, 1.0 - stretch * 0.45);
      cosmetic.targetScaleZ = Math.min(cosmetic.targetScaleZ, 1.0 - stretch * 0.45);

      const tColor = Math.min(1.0, (speed - 15.0) / 55.0);
      const rTarget = 1.0;
      const gTarget = 0.15 + (0.85 * tColor);
      const bTarget = 0.4 + (0.6 * tColor);
      
      cosmetic.emissiveR += (rTarget - cosmetic.emissiveR) * tColor;
      cosmetic.emissiveG += (gTarget - cosmetic.emissiveG) * tColor;
      cosmetic.emissiveB += (bTarget - cosmetic.emissiveB) * tColor;
    }

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

    // Solve vertical landing spring-mass-damper offset
    const currentOffset = cosmetic.visualOffsetY ?? 0;
    const offsetVel = cosmetic.visualOffsetVelocityY ?? 0;
    const springResult = solveOffsetSpring(
      currentOffset,
      0,
      offsetVel,
      dt,
      280.0,
      18.0
    );
    cosmetic.visualOffsetY = springResult.value;
    cosmetic.visualOffsetVelocityY = springResult.velocity;

    const currentRot = cosmetic.currentRotation ?? 0;
    const rotVel = cosmetic.rotationVel ?? 0;
    
    const velocityLean = speedX * -0.022; 
    const targetRot = cosmetic.rotationAngle + velocityLean;

    let diff = targetRot - currentRot;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const adjustedTarget = currentRot + diff;

    const rotStiffness = cosmetic.springStiffness;
    const rotDamping = cosmetic.springDamping;

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
