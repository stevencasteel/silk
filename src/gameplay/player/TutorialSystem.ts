import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { TraversalStateComponent, InputIntentComponent } from "../../core/ecs/Components";
import { useOverlayStore } from "../../ui/hud/hudStore";
import { dispatchUIFeedback, SubscriptionTracker } from "../../core/utils/EngineUtils";
import { GameEvent } from "../../core/events/GameEvents";

export class TutorialSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;

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
        this.step0Completed = false;
        this.step1Completed = false;
        this.step2Completed = false;
        this.reeledUp = false;
        this.reeledDown = false;
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.TETHER_TENSION_CHANGE, ({ tension }) => {
        const overlayStore = useOverlayStore.getState();
        const travStore = this.context.stores.get<TraversalStateComponent>("traversal");
        const pTrav = travStore.get(this.context.refs.player);
        const currentState = pTrav ? pTrav.state : "AIRBORNE";

        if (
          !this.step0Completed &&
          overlayStore.calibrationStep === 0 &&
          currentState === "WALL_SLIDING" &&
          tension >= 0.5
        ) {
          this.step0Completed = true;
          overlayStore.setCalibrationStep(1);
          dispatchUIFeedback("silk-play-confirm");
        }
      })
    );
  }

  public update(dt: number): void {
    void dt;
    const overlayStore = useOverlayStore.getState();

    if (overlayStore.calibrationStep === 1) {
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
          overlayStore.setCalibrationStep(2);
          dispatchUIFeedback("silk-play-confirm");
        }
      }
    }

    if (overlayStore.calibrationStep === 2) {
      const travStore = this.context.stores.get<TraversalStateComponent>("traversal");
      const pTrav = travStore.get(this.context.refs.player);
      if (pTrav && pTrav.state === "LAUNCHING" && pTrav.launchPower >= 0.6) {
        if (!this.step2Completed) {
          this.step2Completed = true;
          overlayStore.setCalibrationStep(3);
          dispatchUIFeedback("silk-play-confirm");
        }
      }
    }
  }

  public dispose(): void {
    this._tracker.clear();
  }
}
