import { ISystem, IInitializable, IDisposable } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  TetherComponent,
  TraversalStateComponent,
  InputIntentComponent,
  KinematicTargetComponent
} from "../../core/ecs/Components";
import { GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";
import { solveSpringDamper, SubscriptionTracker } from "../../core/utils/EngineUtils";
import { GameEvent } from "../../core/events/GameEvents";

export class TetherReelingSystem implements ISystem, IInitializable, IDisposable {
  readonly phase = SystemPhase.Kinematics;
  private _tracker = new SubscriptionTracker();

  constructor(private context: SystemContext) {}

  public init(): void {
    // MAIN GAMEPLAY LOOP: When Weaver is damaged, reel player back to 0% slack (baseline)
    this._tracker.add(
      this.context.broker.subscribe(GameEvent.WEAVER_DAMAGED, () => {
        const tether = this.context.stores.get<TetherComponent>("tether").get(this.context.refs.player);
        if (tether) {
          tether.desiredLength = GAMEPLAY_TUNING.REEL.MIN_LENGTH;
        }
      })
    );
  }

  public update(dt: number): void {
    const tether = this.context.stores.get<TetherComponent>("tether").get(this.context.refs.player);
    const trav = this.context.stores.get<TraversalStateComponent>("traversal").get(this.context.refs.player);

    if (!tether || !trav) return;

    const reelConfig = GAMEPLAY_TUNING.REEL;
    const isWebTrapped = !!trav.isWebTrapped;

    const input = this.context.stores.get<InputIntentComponent>("input").get(this.context.refs.player);
    const target = this.context.stores.get<KinematicTargetComponent>("target").get(this.context.refs.player);

    const isPressingUp = input && input.y > 0;

    if (isPressingUp && !isWebTrapped && target) {
      // Manual Reel-In: Shortens the limit based on input intent
      const minPossibleLength = Math.max(
        reelConfig.MIN_LENGTH,
        Math.abs(target.x - tether.anchorX) + reelConfig.MIN_LENGTH_OFFSET
      );

      tether.desiredLength = Math.max(minPossibleLength, tether.desiredLength - reelConfig.MANUAL_IN_SPEED * dt);
      tether.maxLength = Math.max(minPossibleLength, tether.maxLength - reelConfig.MANUAL_IN_SPEED * dt);
      tether.reelVelocity = -reelConfig.MANUAL_IN_SPEED;
    } else {
      // AUTO-SLACK REMOVED: Players now retain whatever slack they have earned during flings/swings.
      // We only clamp the desiredLength to absolute system limits.
      tether.desiredLength = Math.max(
        reelConfig.MIN_LENGTH,
        Math.min(reelConfig.MAX_LENGTH, tether.desiredLength)
      );

      // Smoothly LERP the physical maxLength toward the desired target via spring-damper
      if (Math.abs(tether.maxLength - tether.desiredLength) > 0.01) {
        const springResult = solveSpringDamper(
          tether.maxLength,
          tether.desiredLength,
          tether.reelVelocity,
          dt,
          reelConfig.SPRING_STIFFNESS,
          reelConfig.SPRING_DAMPING
        );
        tether.maxLength = springResult.value;
        tether.reelVelocity = springResult.velocity;
      } else {
        tether.maxLength = tether.desiredLength;
        tether.reelVelocity = 0;
      }
    }
  }

  public dispose(): void {
    this._tracker.clear();
  }
}
