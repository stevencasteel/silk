import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  TetherComponent,
  TraversalStateComponent,
  InputIntentComponent,
  KinematicTargetComponent
} from "../../core/ecs/Components";
import { GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";
import { solveSpringDamper } from "../../core/utils/EngineUtils";

export class TetherReelingSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;

  constructor(private context: SystemContext) {}

  public update(dt: number): void {
    const tether = this.context.stores.get<TetherComponent>("tether").get(this.context.refs.player);
    const trav = this.context.stores
      .get<TraversalStateComponent>("traversal")
      .get(this.context.refs.player);

    if (!tether || !trav) return;

    const reelConfig = GAMEPLAY_TUNING.REEL;
    const isWebTrapped = !!trav.isWebTrapped;

    const input = this.context.stores.get<InputIntentComponent>("input").get(this.context.refs.player);
    const target = this.context.stores.get<KinematicTargetComponent>("target").get(this.context.refs.player);

    const isPressingUp = input && input.y > 0;

    if (isPressingUp && !isWebTrapped && target) {
      const manualInSpeed = 16.0;
      const minPossibleLength = Math.max(
        reelConfig.MIN_LENGTH,
        Math.abs(target.x - tether.anchorX) + 0.5
      );

      tether.desiredLength = Math.max(minPossibleLength, tether.desiredLength - manualInSpeed * dt);
      tether.maxLength = Math.max(minPossibleLength, tether.maxLength - manualInSpeed * dt);
      tether.reelVelocity = -manualInSpeed;
    } else {
      const AUTO_SLACK_MARGIN = 0.5;
      if (!isWebTrapped) {
        tether.desiredLength = Math.min(
          tether.desiredLength,
          tether.currentLength + AUTO_SLACK_MARGIN
        );
      }
      tether.desiredLength = Math.max(reelConfig.MIN_LENGTH, Math.min(reelConfig.MAX_LENGTH, tether.desiredLength));

      if (Math.abs(tether.maxLength - tether.desiredLength) > 0.01) {
        const springResult = solveSpringDamper(
          tether.maxLength,
          tether.desiredLength,
          tether.reelVelocity,
          dt,
          180.0,
          15.0
        );
        tether.maxLength = springResult.value;
        tether.reelVelocity = springResult.velocity;
      } else {
        tether.maxLength = tether.desiredLength;
        tether.reelVelocity = 0;
      }
    }
  }
}
