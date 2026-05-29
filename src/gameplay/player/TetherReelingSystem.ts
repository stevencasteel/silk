import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  TetherComponent,
  InputIntentComponent,
  TraversalStateComponent
} from "../../core/ecs/Components";
import { GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";

export class TetherReelingSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;

  constructor(private context: SystemContext) {}

  public update(dt: number): void {
    const tether = this.context.stores.get<TetherComponent>("tether").get(this.context.refs.player);
    const input = this.context.stores
      .get<InputIntentComponent>("input")
      .get(this.context.refs.player);
    const trav = this.context.stores
      .get<TraversalStateComponent>("traversal")
      .get(this.context.refs.player);

    if (!tether || !input || !trav) return;

    const reelConfig = GAMEPLAY_TUNING.REEL;
    const isWallSliding = trav.state === "WALL_SLIDING";
    const isTrapped = !!trav.isWebTrapped;
    const webMass = trav.webMass || 1;
    const trappedMultiplier = isTrapped ? Math.max(0.1, 0.5 - (webMass - 1) * 0.1) : 1.0;

    if (input.y > 0 && !isWallSliding) {
      tether.desiredLength -= reelConfig.IN_SPEED * trappedMultiplier * dt;
      tether.reelHeat = Math.min(1.0, tether.reelHeat + dt * 1.2 * trappedMultiplier);
    } else if (input.y < 0 && !isWallSliding) {
      tether.desiredLength += reelConfig.OUT_SPEED * trappedMultiplier * dt;
      tether.reelHeat = Math.max(0.0, tether.reelHeat - dt * 1.5 * trappedMultiplier);
    } else {
      tether.reelHeat = Math.max(0.0, tether.reelHeat - dt * 0.8);
      const AUTO_SLACK_MARGIN = 2.0;
      tether.desiredLength = Math.min(
        tether.desiredLength,
        tether.currentLength + AUTO_SLACK_MARGIN
      );
    }
    tether.desiredLength = Math.max(
      reelConfig.MIN_LENGTH,
      Math.min(reelConfig.MAX_LENGTH, tether.desiredLength)
    );

    let easeSpeed = 0;
    if (tether.maxLength > tether.desiredLength) {
      const resistance = Math.max(0.1, 1.0 - tether.tension);
      easeSpeed = reelConfig.IN_SPEED * resistance * trappedMultiplier;
      tether.reelVelocity = -easeSpeed;
    } else if (tether.maxLength < tether.desiredLength) {
      easeSpeed = reelConfig.OUT_SPEED * trappedMultiplier;
      tether.reelVelocity = easeSpeed;
    } else {
      tether.reelVelocity = 0;
    }

    const maxDelta = easeSpeed * dt;
    if (Math.abs(tether.maxLength - tether.desiredLength) <= maxDelta) {
      tether.maxLength = tether.desiredLength;
    } else {
      tether.maxLength += Math.sign(tether.desiredLength - tether.maxLength) * maxDelta;
    }
  }
}
