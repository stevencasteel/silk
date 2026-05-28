import { solveScaleSpring } from "../../core/utils/EngineUtils";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  TransformComponent,
  TetherComponent,
  TraversalStateComponent,
  KinematicTargetComponent,
  KinematicVelocityComponent
} from "../../core/ecs/Components";
import { GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";
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
    const tether = this.context.stores.get<TetherComponent>("tether").get(this.context.refs.player);
    const trav = this.context.stores
      .get<TraversalStateComponent>("traversal")
      .get(this.context.refs.player);
    const target = this.context.stores
      .get<KinematicTargetComponent>("target")
      .get(this.context.refs.player);
    const vel = this.context.stores
      .get<KinematicVelocityComponent>("velocity")
      .get(this.context.refs.player);

    if (!pTrans || !tether || !trav || !target || !vel) return;

    pTrans.prevScaleX = pTrans.scaleX!;
    pTrans.prevScaleY = pTrans.scaleY!;
    pTrans.prevScaleZ = pTrans.scaleZ!;

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
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      const stretchFactor = Math.min(
        tuning.SQUASH_STRETCH.AIRBORNE_STRETCH_MAX,
        (speed / tuning.SQUASH_STRETCH.AIRBORNE_SPEED_BASIS) *
          tuning.SQUASH_STRETCH.AIRBORNE_STRETCH_MAX
      );
      targetScaleY = 1.0 + stretchFactor;
      targetScaleX = 1.0 - stretchFactor * 0.5;
      targetScaleZ = 1.0 - stretchFactor * 0.5;
    }

    solveScaleSpring(pTrans, targetScaleX, targetScaleY, targetScaleZ, dt, 220, 14);

    pTrans.scaleX = Math.max(0.1, pTrans.scaleX!);
    pTrans.scaleY = Math.max(0.1, pTrans.scaleY!);
    pTrans.scaleZ = Math.max(0.1, pTrans.scaleZ!);

    let rotDx = 0;
    let rotDy = 1;

    if (trav.state === "LAUNCHING") {
      const vx = vel.x;
      const vy = vel.y;
      if (vx * vx + vy * vy > 1.0) {
        rotDx = vx;
        rotDy = vy;
      }
    } else if (trav.state === "AIRBORNE") {
      rotDx = tether.anchorX - target.x;
      rotDy = tether.anchorY - target.y;
    }

    const targetAngle = rotDx !== 0 || rotDy !== 1 ? -Math.atan2(rotDx, rotDy) : 0;
    BABYLON.Quaternion.RotationAxisToRef(BABYLON.Axis.Z, targetAngle, this._targetQuat);

    this._currentQuat.set(pTrans.qx, pTrans.qy, pTrans.qz, pTrans.qw);

    BABYLON.Quaternion.SlerpToRef(
      this._currentQuat,
      this._targetQuat,
      tuning.SLERP_FACTOR,
      this._currentQuat
    );

    pTrans.qx = this._currentQuat.x;
    pTrans.qy = this._currentQuat.y;
    pTrans.qz = this._currentQuat.z;
    pTrans.qw = this._currentQuat.w;
  }
}
