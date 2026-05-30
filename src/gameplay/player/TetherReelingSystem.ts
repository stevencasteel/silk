import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  TetherComponent,
  TraversalStateComponent
} from "../../core/ecs/Components";
import { GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";

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

    tether.reelHeat = Math.max(0.0, tether.reelHeat - dt * 0.8);

    const AUTO_SLACK_MARGIN = 0.5;
    if (!isWebTrapped) {
      tether.desiredLength = Math.min(
        tether.desiredLength,
        tether.currentLength + AUTO_SLACK_MARGIN
      );
    }
    tether.desiredLength = Math.max(reelConfig.MIN_LENGTH, Math.min(reelConfig.MAX_LENGTH, tether.desiredLength));

    if (tether.maxLength > tether.desiredLength) {
      // Reeling IN (Slack takeup)
      const resistance = Math.max(0.1, 1.0 - tether.tension);
      const easeSpeed = reelConfig.IN_SPEED * resistance;
      const maxDelta = easeSpeed * dt;
      if (Math.abs(tether.maxLength - tether.desiredLength) <= maxDelta) {
        tether.maxLength = tether.desiredLength;
      } else {
        tether.maxLength += Math.sign(tether.desiredLength - tether.maxLength) * maxDelta;
      }
      tether.reelVelocity = -easeSpeed;
    } else if (tether.maxLength < tether.desiredLength) {
      // Reeling OUT
      const rate = 16.0;
      const lerpFactor = 1.0 - Math.exp(-dt * rate);
      tether.maxLength += (tether.desiredLength - tether.maxLength) * lerpFactor;
      tether.reelVelocity = (tether.desiredLength - tether.maxLength) * rate;
    } else {
      tether.reelVelocity = 0;
    }
  }
}
