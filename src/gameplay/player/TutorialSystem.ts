import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { TraversalStateComponent, InputIntentComponent } from "../../core/ecs/Components";
import { dispatchUIFeedback, SubscriptionTracker } from "../../core/utils/EngineUtils";
import { GameEvent } from "../../core/events/GameEvents";

export class TutorialSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;

  private calibrationStep = 0;
  private step0Completed = false;
  private step1Completed = false;
  private step2Completed = false;

  private reeledUp = false;
  private reeledDown = false;

  private _tracker = new SubscriptionTracker();

  constructor(private context: SystemContext) {}

  public init(): void {
    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.calibrationStep = 0;
        this.step0Completed = false;
        this.step1Completed = false;
        this.step2Completed = false;
        this.reeledUp = false;
        this.reeledDown = false;
        this.context.broker.publish(GameEvent.UI_CALIBRATION_STEP_CHANGED, { step: 0 });
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.TETHER_TENSION_CHANGE, ({ tension }) => {
        const travStore = this.context.stores.get<TraversalStateComponent>("traversal");
        const pTrav = travStore.get(this.context.refs.player);
        const currentState = pTrav ? pTrav.state : "AIRBORNE";

        if (
          !this.step0Completed &&
          this.calibrationStep === 0 &&
          currentState === "WALL_SLIDING" &&
          tension >= 0.375
        ) {
          this.step0Completed = true;
          this.calibrationStep = 1;
          this.context.broker.publish(GameEvent.UI_CALIBRATION_STEP_CHANGED, { step: 1 });
          dispatchUIFeedback("silk-play-confirm");
        }
      })
    );
  }

  public update(dt: number): void {
    void dt;

    if (this.calibrationStep === 1) {
      const inputStore = this.context.stores.get<InputIntentComponent>("input");
      const input = inputStore.get(this.context.refs.player);
      if (input) {
        if (input.y > 0) {
          this.reeledUp = true;
        } else if (input.y < 0) {
          this.reeledDown = true;
        }

        if (!this.step1Completed && this.reeledUp && this.reeledDown) {
          this.step1Completed = true;
          this.calibrationStep = 2;
          this.context.broker.publish(GameEvent.UI_CALIBRATION_STEP_CHANGED, { step: 2 });
          dispatchUIFeedback("silk-play-confirm");
        }
      }
    }

    if (this.calibrationStep === 2) {
      const travStore = this.context.stores.get<TraversalStateComponent>("traversal");
      const pTrav = travStore.get(this.context.refs.player);
      if (pTrav && pTrav.state === "LAUNCHING" && pTrav.launchPower >= 0.45) {
        if (!this.step2Completed) {
          this.step2Completed = true;
          this.calibrationStep = 3;
          this.context.broker.publish(GameEvent.UI_CALIBRATION_STEP_CHANGED, { step: 3 });
          dispatchUIFeedback("silk-play-confirm");
        }
      }
    }
  }

  public dispose(): void {
    this._tracker.clear();
  }
}
