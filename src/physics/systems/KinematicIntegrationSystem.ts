import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  HitStopComponent,
  TransformComponent,
  KinematicVelocityComponent
} from "../../core/ecs/Components";

export class KinematicIntegrationSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;

  constructor(private context: SystemContext) {}

  public update(dt: number): void {
    const transforms = this.context.stores.get<TransformComponent>("transform");
    const velocities = this.context.stores.get<KinematicVelocityComponent>("velocity");
    const hitStops = this.context.stores.get<HitStopComponent>("hitStop");

    transforms.forEach((id, trans) => {
      trans.z = 0.0;
      trans.prevZ = 0.0;

      const vel = velocities.get(id);
      if (vel) {
        vel.z = 0.0;
      }

      const hs = hitStops.get(id);
      if (hs && hs.timeRemaining > 0) return;
      if (id === this.context.refs.player || id === this.context.refs.weaver) {
        return;
      }

      if (vel) {
        trans.x += vel.x * dt;
        trans.y += vel.y * dt;
      }
    });
  }
}
