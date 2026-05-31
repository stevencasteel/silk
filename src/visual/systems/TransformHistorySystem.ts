import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { TransformComponent } from "../../core/ecs/Components";
import { SystemContext } from "../../core/engine/SystemContext";

export class TransformHistorySystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;

  constructor(private context: SystemContext) {}

  public update(): void {
    const transforms = this.context.stores.get<TransformComponent>("transform");
    for (const [, curr] of transforms.entries()) {
      curr.prevX = curr.x;
      curr.prevY = curr.y;
      curr.prevZ = curr.z;
      curr.prevQx = curr.qx;
      curr.prevQy = curr.qy;
      curr.prevQz = curr.qz;
      curr.prevQw = curr.qw;
      if (curr.scaleX !== undefined) {
        curr.prevScaleX = curr.scaleX;
      }
      if (curr.scaleY !== undefined) {
        curr.prevScaleY = curr.scaleY;
      }
      if (curr.scaleZ !== undefined) {
        curr.prevScaleZ = curr.scaleZ;
      }
    }
  }
}
