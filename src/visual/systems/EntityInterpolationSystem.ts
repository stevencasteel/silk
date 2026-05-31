import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { TransformComponent, PlayerCosmeticComponent } from "../../core/ecs/Components";
import { SystemContext } from "../../core/engine/SystemContext";
import * as BABYLON from "@babylonjs/core";

export class EntityInterpolationSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;

  private scratchPrevQuat = new BABYLON.Quaternion();
  private scratchCurrQuat = new BABYLON.Quaternion();

  constructor(private context: SystemContext) {}

  public render(alpha: number): void {
    const transforms = this.context.stores.get<TransformComponent>("transform");
    for (const [id, curr] of transforms.entries()) {
      const node = this.context.visualRegistry.getTransformNode(id);
      if (!node) continue;

      const deltaX = curr.x - curr.prevX;
      const deltaY = curr.y - curr.prevY;
      const distSq = deltaX * deltaX + deltaY * deltaY;

      let interpolatedY = curr.prevY + deltaY * alpha;
      let finalY = curr.y;
      if (id === this.context.refs.player) {
        const cosmeticStore = this.context.stores.get<PlayerCosmeticComponent>("playerCosmetic");
        const cosmetic = cosmeticStore.get(id);
        if (cosmetic && cosmetic.visualOffsetY !== undefined) {
          interpolatedY += cosmetic.visualOffsetY;
          finalY += cosmetic.visualOffsetY;
        }
      }

      if (distSq > 400.0) {
        node.position.x = curr.x;
        node.position.y = finalY;
        node.position.z = curr.z;
      } else {
        node.position.x = curr.prevX + deltaX * alpha;
        node.position.y = interpolatedY;
        node.position.z = curr.prevZ + (curr.z - curr.prevZ) * alpha;
      }

      const sx =
        curr.prevScaleX !== undefined && curr.scaleX !== undefined
          ? curr.prevScaleX + (curr.scaleX - curr.prevScaleX) * alpha
          : 1.0;
      const sy =
        curr.prevScaleY !== undefined && curr.scaleY !== undefined
          ? curr.prevScaleY + (curr.scaleY - curr.prevScaleY) * alpha
          : 1.0;
      const sz =
        curr.prevScaleZ !== undefined && curr.scaleZ !== undefined
          ? curr.prevScaleZ + (curr.scaleZ - curr.prevScaleZ) * alpha
          : 1.0;
      node.scaling.set(sx, sy, sz);

      this.scratchPrevQuat.set(curr.prevQx, curr.prevQy, curr.prevQz, curr.prevQw);
      this.scratchCurrQuat.set(curr.qx, curr.qy, curr.qz, curr.qw);

      if (!node.rotationQuaternion) {
        node.rotationQuaternion = new BABYLON.Quaternion();
      }
      BABYLON.Quaternion.SlerpToRef(
        this.scratchPrevQuat,
        this.scratchCurrQuat,
        alpha,
        node.rotationQuaternion
      );
    }
  }
}
