import { ISpatialQueryService, IRaycastHitResult } from "../../contracts/ISpatialQuery";
import { SystemContext } from "../../core/engine/SystemContext";
import * as BABYLON from "@babylonjs/core";

export class SpatialQueryService implements ISpatialQueryService {
  private _raycastResult = new BABYLON.PhysicsRaycastResult();
  private _rayStart = new BABYLON.Vector3();
  private _rayEnd = new BABYLON.Vector3();

  constructor(private context: SystemContext) {}

  public castHorizontalRay(
    startX: number,
    startY: number,
    directionX: number,
    length: number
  ): IRaycastHitResult {
    const scene = this.context.visualQuery.getScene();
    const physicsEngine = scene?.getPhysicsEngine() as BABYLON.PhysicsEngine | null;

    if (physicsEngine) {
      this._rayStart.set(startX, startY, 0);
      this._rayEnd.set(startX + Math.sign(directionX) * length, startY, 0);
      physicsEngine.raycastToRef(this._rayStart, this._rayEnd, this._raycastResult);

      if (this._raycastResult.hasHit && this._raycastResult.body) {
        return {
          hasHit: true,
          hitDistance: this._raycastResult.hitDistance,
          hitPointX: this._raycastResult.hitPointWorld.x,
          hitPointY: this._raycastResult.hitPointWorld.y,
          hitNormalX: this._raycastResult.hitNormalWorld.x,
          hitNormalY: this._raycastResult.hitNormalWorld.y
        };
      }
    }

    return {
      hasHit: false,
      hitDistance: 0,
      hitPointX: 0,
      hitPointY: 0,
      hitNormalX: 0,
      hitNormalY: 0
    };
  }

  public castVerticalRay(
    startX: number,
    startY: number,
    directionY: number,
    length: number
  ): IRaycastHitResult {
    const scene = this.context.visualQuery.getScene();
    const physicsEngine = scene?.getPhysicsEngine() as BABYLON.PhysicsEngine | null;

    if (physicsEngine) {
      this._rayStart.set(startX, startY, 0);
      this._rayEnd.set(startX, startY + Math.sign(directionY) * length, 0);
      physicsEngine.raycastToRef(this._rayStart, this._rayEnd, this._raycastResult);

      if (this._raycastResult.hasHit && this._raycastResult.body) {
        return {
          hasHit: true,
          hitDistance: this._raycastResult.hitDistance,
          hitPointX: this._raycastResult.hitPointWorld.x,
          hitPointY: this._raycastResult.hitPointWorld.y,
          hitNormalX: this._raycastResult.hitNormalWorld.x,
          hitNormalY: this._raycastResult.hitNormalWorld.y
        };
      }
    }

    return {
      hasHit: false,
      hitDistance: 0,
      hitPointX: 0,
      hitPointY: 0,
      hitNormalX: 0,
      hitNormalY: 0
    };
  }

  public checkAabbWallCling(
    targetX: number,
    targetY: number,
    halfWidth: number
  ): { isWallClinging: boolean; wallNormalX: number } {
    const wallCheckDist = halfWidth + 0.15;
    const lHit = this.castHorizontalRay(targetX, targetY, -1, wallCheckDist);
    if (lHit.hasHit) {
      return { isWallClinging: true, wallNormalX: 1 };
    }
    const rHit = this.castHorizontalRay(targetX, targetY, 1, wallCheckDist);
    if (rHit.hasHit) {
      return { isWallClinging: true, wallNormalX: -1 };
    }
    return { isWallClinging: false, wallNormalX: 0 };
  }
}
