import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { TraversalStateComponent } from "../../core/ecs/Components";
import { SubscriptionTracker } from "../../core/utils/EngineUtils";
import { GameEvent } from "../../core/events/GameEvents";

export class TutorialSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;

  private calibrationStep = 0;
  private step0Completed = false;
  private step1Completed = false;

  private _tracker = new SubscriptionTracker();

  constructor(private context: SystemContext) {}

  public init(): void {
    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.calibrationStep = 0;
        this.step0Completed = false;
        this.step1Completed = false;
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
          currentState === "WALL_STICKING" &&
          tension >= 0.555
        ) {
          this.step0Completed = true;
          this.calibrationStep = 1;
          this.context.broker.publish(GameEvent.UI_CALIBRATION_STEP_CHANGED, { step: 1 });
          this.context.broker.publish(GameEvent.UI_SFX_DING, undefined);
        }
      })
    );
  }

  public update(dt: number): void {
    void dt;

    if (this.calibrationStep === 1) {
      const travStore = this.context.stores.get<TraversalStateComponent>("traversal");
      const pTrav = travStore.get(this.context.refs.player);
      if (pTrav && pTrav.state === "LAUNCHING" && pTrav.launchPower >= 0.45) {
        if (!this.step1Completed) {
          this.step1Completed = true;
          this.calibrationStep = 2;
          this.context.broker.publish(GameEvent.UI_CALIBRATION_STEP_CHANGED, { step: 2 });
          this.context.broker.publish(GameEvent.UI_SFX_DING, undefined);
        }
      }
    }
  }

  public dispose(): void {
    this._tracker.clear();
  }
}
