import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { KinematicVelocityComponent, WardenTraversalComponent, TransformComponent, KinematicTargetComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { PLATFORM_AABBS, BORDER_AABBS } from "../../physics/collisions/EnvironmentColliders";

export class WardenTraversalSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;
  private gravity = -22.0;
  private maxFallSpeed = -35.0;

  constructor(
    private refs: EntityRefs,
    private velocities: ComponentStore<KinematicVelocityComponent>,
    private traversal: ComponentStore<WardenTraversalComponent>,
    private transforms: ComponentStore<TransformComponent>,
    private targets: ComponentStore<KinematicTargetComponent>
  ) {}

  public update(dt: number): void {
    const vel = this.velocities.get(this.refs.warden);
    const trav = this.traversal.get(this.refs.warden);
    const trans = this.transforms.get(this.refs.warden);
    const target = this.targets.get(this.refs.warden);
    if (!vel || !trav || !trans || !target) return;

    let resolvedVelX = vel.x;
    let resolvedVelY = vel.y;

    if (!trav.isGrounded && vel.y <= 0.1) {
      trav.velY += this.gravity * dt;
      if (trav.velY < this.maxFallSpeed) trav.velY = this.maxFallSpeed;
      resolvedVelY += trav.velY;
    } else if (trav.isGrounded && vel.y <= 0.1) {
      trav.velY = 0;
    }

    let nextX = trans.x + resolvedVelX * dt;
    let nextY = trans.y + resolvedVelY * dt;

    trav.isGrounded = false;
    trav.isWallClinging = false;
    trav.wallNormalX = 0;

    const wHalfW = 1.0;
    const wHalfH = 1.0;
    const allColliders = [...PLATFORM_AABBS, ...BORDER_AABBS];

    for (const aabb of allColliders) {
      const overlapX = (nextX + wHalfW > aabb.minX) && (nextX - wHalfW < aabb.maxX);
      const overlapY = (nextY + wHalfH > aabb.minY) && (nextY - wHalfH < aabb.maxY);

      if (overlapX && overlapY) {
        const overlapDepthX = Math.min(nextX + wHalfW - aabb.minX, aabb.maxX - (nextX - wHalfW));
        const overlapDepthY = Math.min(nextY + wHalfH - aabb.minY, aabb.maxY - (nextY - wHalfH));

        if (overlapDepthY < overlapDepthX) {
          if (nextY > (aabb.minY + aabb.maxY) / 2) {
            nextY = aabb.maxY + wHalfH;
            trav.isGrounded = true;
            trav.velY = 0;
            resolvedVelY = 0;
          } else {
            nextY = aabb.minY - wHalfH;
            trav.velY = 0;
            resolvedVelY = 0;
          }
        } else {
          if (nextX > (aabb.minX + aabb.maxX) / 2) {
            nextX = aabb.maxX + wHalfW;
            trav.wallNormalX = 1;
          } else {
            nextX = aabb.minX - wHalfW;
            trav.wallNormalX = -1;
          }
          trav.isWallClinging = true;
          resolvedVelX = 0;
        }
      }
    }

    vel.x = resolvedVelX;
    vel.y = resolvedVelY;

    target.x = nextX;
    target.y = nextY;
  }
}
