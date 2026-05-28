import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { TransformComponent, KinematicVelocityComponent } from "../../core/ecs/Components";

export class KinematicIntegrationSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;

  constructor(private context: SystemContext) {}

  public update(dt: number): void {
    const transforms = this.context.stores.get<TransformComponent>("transform");
    const velocities = this.context.stores.get<KinematicVelocityComponent>("velocity");

    for (const [id, trans] of transforms.entries()) {
      if (id === this.context.refs.player || id === this.context.refs.weaver) {
        continue;
      }

      const vel = velocities.get(id);
      if (vel) {
        trans.x += vel.x * dt;
        trans.y += vel.y * dt;
        trans.z += vel.z * dt;
      }
    }
  }
}
