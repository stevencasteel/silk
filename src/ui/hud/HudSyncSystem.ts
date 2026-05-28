import { dispatchUIFeedback } from "../../core/utils/EngineUtils";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import {
  TraversalStateComponent,
  InputIntentComponent
} from "../../core/ecs/Components";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  usePlayerStore,
  useWeaverStore,
  useOverlayStore,
  resetAllStores
} from "./hudStore";

export class HudSyncSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private subscriptions: (() => void)[] = [];
  private lastHintLevel: "none" | "charging" | "ready" | "maxout" = "none";
  private currentState: string = "AIRBORNE";

  private lastTetherLength = 0.0;
  private reeledUp = false;
  private reeledDown = false;

  private step0Completed = false;
  private step1Completed = false;
  private step2Completed = false;

  constructor(private context: SystemContext) {
    this.broker = this.context.broker;
    this.registerSubscriptions();
  }

  private broker: EventBroker;

  public init(): void {
    const overlayStore = useOverlayStore.getState();
    overlayStore.loadStats();
  }

  private registerSubscriptions(): void {
    const playerStore = usePlayerStore.getState();
    const weaverStore = useWeaverStore.getState();
    const overlayStore = useOverlayStore.getState();

    this.subscriptions.push(
      this.broker.subscribe(GameEvent.GAME_BOOT_PROGRESS, ({ status }) => {
        overlayStore.setBootStatus(status);
      })
    );

    this.subscriptions.push(
      this.broker.subscribe(GameEvent.TETHER_TENSION_CHANGE, ({ tension }) => {
        this.updateHint(tension);

        if (!this.step0Completed && overlayStore.calibrationStep === 0 && this.currentState === "WALL_SLIDING" && tension >= 0.5) {
          this.step0Completed = true;
          overlayStore.setCalibrationStep(1);
          dispatchUIFeedback("silk-play-confirm")
        }

        const evt = new CustomEvent("silk-tension-render-tick", { detail: { tension } });
        window.dispatchEvent(evt);
      })
    );

    this.subscriptions.push(
      this.broker.subscribe(GameEvent.TETHER_LENGTH_CHANGE, ({ maxLength }) => {
        if (this.lastTetherLength > 0.0) {
          const delta = maxLength - this.lastTetherLength;
          if (overlayStore.calibrationStep === 1) {
            if (delta < -0.01) {
              this.reeledUp = true;
            } else if (delta > 0.01) {
              this.reeledDown = true;
            }

            if (!this.step1Completed && this.reeledUp && this.reeledDown) {
              this.step1Completed = true;
              overlayStore.setCalibrationStep(2);
              dispatchUIFeedback("silk-play-confirm")
            }
          }
        }
        this.lastTetherLength = maxLength;
      })
    );

    this.subscriptions.push(
      this.broker.subscribe(GameEvent.PLAYER_STATE_CHANGE, ({ state }) => {
        this.currentState = state;
        playerStore.setCurrentState(state);

        if (state !== "WALL_SLIDING") {
          this.setHint("none");
        }
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.PLAYER_HEALTH_CHANGED, ({ hp, maxHp }) => {
        playerStore.setPlayerHp(hp, maxHp);
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.WEAVER_HEALTH_CHANGED, ({ hp, maxHp }) => {
        weaverStore.setWeaverHealth(hp, maxHp);
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.WEAVER_STATE_CHANGE, ({ state, hue }) => {
        weaverStore.setWeaverState(state, hue);
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.GAME_OVER, () => {
        overlayStore.recordLoss();
        overlayStore.showOverlay("DEFEATED", "rgb(239, 68, 68)", "The line was severed.");
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.GAME_WIN, () => {
        overlayStore.recordWin();
        overlayStore.showOverlay("VICTORY", "rgb(16, 185, 129)", "The shaft is clear.");
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.GAME_RESET, () => {
        resetAllStores();
        overlayStore.loadStats();
        this.lastTetherLength = 0.0;
        this.reeledUp = false;
        this.reeledDown = false;
        this.step0Completed = false;
        this.step1Completed = false;
        this.step2Completed = false;
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.GAME_PAUSED, ({ isPaused }) => {
        overlayStore.setPaused(isPaused);
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.USER_GESTURE_REGISTERED, () => {
        overlayStore.setAwaitingGesture(false);
        overlayStore.setBootStatus("READY");
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
          dispatchUIFeedback("silk-play-confirm")
        }
      }
    }

    if (overlayStore.calibrationStep === 2) {
      const travStore = this.context.stores.get<TraversalStateComponent>("traversal");
      const pTrav = travStore.get(this.context.refs.player);
      if (pTrav && pTrav.state === "LAUNCHING" && pTrav.launchPower >= 0.60) {
        if (!this.step2Completed) {
          this.step2Completed = true;
          overlayStore.setCalibrationStep(3);
          dispatchUIFeedback("silk-play-confirm")
        }
      }
    }
  }

  private updateHint(tension: number): void {
    if (this.currentState !== "WALL_SLIDING") return;
    if (tension >= 1.0) {
      this.setHint("maxout");
    } else if (tension >= 0.85) {
      this.setHint("ready");
    } else if (tension > 0.02) {
      this.setHint("charging");
    } else {
      this.setHint("none");
    }
  }

  private setHint(level: "none" | "charging" | "ready" | "maxout"): void {
    if (level === this.lastHintLevel) return;
    this.lastHintLevel = level;
    const store = useOverlayStore.getState();
    switch (level) {
      case "none":
        store.setTraversalHint("", "rgb(161, 161, 170)", 0);
        break;
      case "charging":
        store.setTraversalHint("HOLD — CHARGING TETHER", "rgb(161, 161, 170)", 1);
        break;
      case "ready":
        store.setTraversalHint("RELEASE CLING TO LAUNCH", "rgb(245, 158, 11)", 1);
        break;
      case "maxout":
        store.setTraversalHint("MAX TENSION — LET GO NOW", "rgb(239, 68, 68)", 1);
        break;
    }
  }

  public dispose(): void {
    this.subscriptions.forEach((u) => u());
    this.subscriptions = [];
  }
}
