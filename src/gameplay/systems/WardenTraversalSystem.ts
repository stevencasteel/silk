import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { KinematicVelocityComponent, WardenTraversalComponent, TransformComponent, KinematicTargetComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";

export class WardenTraversalSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;
  private minX = -12.0;
  private maxX = 12.0;
  private moveSpeed = 4.5;

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

    // Translate coordinates horizontally along the ceiling (Y = 26.0)
    let nextX = trans.x + vel.x * dt;

    if (nextX >= this.maxX) {
      nextX = this.maxX;
      vel.x = -this.moveSpeed;
    } else if (nextX <= this.minX) {
      nextX = this.minX;
      vel.x = this.moveSpeed;
    }

    target.x = nextX;
    target.y = 26.0; // Fixed ceiling anchor elevation
    target.active = true;

    trav.velX = vel.x;
    trav.velY = 0;
  }
}
