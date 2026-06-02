import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  TransformComponent,
  CollisionStateComponent,
  BoundaryConstraintComponent
} from "../../core/ecs/Components";

export class EnvironmentClampingSystem implements ISystem {
  readonly phase = SystemPhase.Collision;

  constructor(private context: SystemContext) {}

  public update(dt: number): void {
    void dt;
    const transforms = this.context.stores.get<TransformComponent>("transform");
    const collisionStore = this.context.stores.get<CollisionStateComponent>("collisionState");
    const constraints = this.context.stores.get<BoundaryConstraintComponent>("boundaryConstraint");

    transforms.forEach((id) => {
      if (!collisionStore.has(id)) {
        collisionStore.add(id, {
          isGrounded: false,
          isWallClinging: false,
          wallNormalX: 0,
          wallNormalY: 0,
          lastHitType: "NONE",
          hitPointX: 0,
          hitPointY: 0
        });
      }
    });

    constraints.forEach((id, constraint) => {
      if (!constraint.isActive) return;

      const trans = transforms.get(id);
      if (!trans) return;

      const hitRight = trans.x >= constraint.limitX;
      const hitLeft = trans.x <= -constraint.limitX;

      if (hitRight || hitLeft) {
        const hitSide = hitRight ? "RIGHT" : "LEFT";
        
        trans.x = hitRight ? constraint.limitX : -constraint.limitX;
        trans.prevX = trans.x;
        
        if (constraint.onBoundaryHit) {
          constraint.onBoundaryHit(id, hitSide, trans.x);
        }
      } else {
        if (constraint.layer === "PLAYER") {
          const pCol = collisionStore.get(id);
          if (pCol) {
            pCol.isWallClinging = false;
            pCol.wallNormalX = 0;
          }
        }
      }
    });
  }
}
