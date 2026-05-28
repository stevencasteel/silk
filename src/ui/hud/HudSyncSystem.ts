import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import {
  TraversalStateComponent
} from "../../core/ecs/Components";
import { GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  usePlayerStore,
  useWeaverStore,
  useTetherStore,
  useOverlayStore,
  resetAllStores
} from "./hudStore";

export class HudSyncSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private subscriptions: (() => void)[] = [];
  private lastHintLevel: "none" | "charging" | "ready" | "maxout" = "none";
  private currentState: string = "AIRBORNE";

  private lastTetherLength = 0.0;

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
    const tetherStore = useTetherStore.getState();
    const overlayStore = useOverlayStore.getState();

    this.subscriptions.push(
      this.broker.subscribe(GameEvent.GAME_BOOT_PROGRESS, ({ status }) => {
        overlayStore.setBootStatus(status);
      })
    );

    this.subscriptions.push(
      this.broker.subscribe(GameEvent.TETHER_TENSION_CHANGE, ({ tension }) => {
        this.updateHint(tension);
        tetherStore.setTetherTension(tension);

        // React Bypass: Dispatch custom event directly into the window thread for instant direct DOM updates
        const evt = new CustomEvent("silk-tension-render-tick", { detail: { tension } });
        window.dispatchEvent(evt);
      })
    );

    this.subscriptions.push(
      this.broker.subscribe(GameEvent.TETHER_LENGTH_CHANGE, ({ maxLength }) => {
        // Active Calibration: Check if W/S reeling is actively performed while sliding on wall
        if (this.currentState === "WALL_SLIDING") {
          const delta = Math.abs(maxLength - this.lastTetherLength);
          if (delta > 0.01) {
            if (overlayStore.calibrationStep === 1) {
              overlayStore.setCalibrationStep(2);
              try {
                window.dispatchEvent(new CustomEvent("silk-play-confirm"));
              } catch (err) {
                void err;
              }
            }
          }
          this.lastTetherLength = maxLength;
        }
      })
    );

    this.subscriptions.push(
      this.broker.subscribe(GameEvent.PLAYER_WALL_HIT, () => {
        // Active Calibration: Mark Wall-Cling milestone complete (Step 0 -> Step 1)
        if (overlayStore.calibrationStep === 0) {
          overlayStore.setCalibrationStep(1);
          try {
            window.dispatchEvent(new CustomEvent("silk-play-confirm"));
          } catch (err) {
            void err;
          }
        }
      })
    );

    this.subscriptions.push(
      this.broker.subscribe(GameEvent.PLAYER_STATE_CHANGE, ({ state }) => {
        this.currentState = state;
        playerStore.setCurrentState(state);

        // Active Calibration: Detect if player performed a fling transition within sweet spot boundaries
        if (state === "LAUNCHING") {
          const travStore = this.context.stores.get<TraversalStateComponent>("traversal");
          const pTrav = travStore.get(this.context.refs.player);
          if (pTrav) {
            const reelConfig = GAMEPLAY_TUNING.REEL;
            const power = pTrav.launchPower;
            if (overlayStore.calibrationStep === 2) {
              if (power >= reelConfig.SWEET_SPOT_MIN && power <= reelConfig.SWEET_SPOT_MAX) {
                overlayStore.setCalibrationStep(3);
                try {
                  window.dispatchEvent(new CustomEvent("silk-play-confirm"));
                } catch (err) {
                  void err;
                }
              }
            }
          }
        }

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
        console.log("[HudSyncSystem] GAME_OVER received! Dispatched showing DEFEATED overlay.");
        overlayStore.recordLoss();
        overlayStore.showOverlay("DEFEATED", "rgb(239, 68, 68)", "The line was severed.");
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.GAME_WIN, () => {
        console.log("[HudSyncSystem] GAME_WIN received! Dispatched showing VICTORY overlay.");
        overlayStore.recordWin();
        overlayStore.showOverlay("VICTORY", "rgb(16, 185, 129)", "The shaft is clear.");
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.GAME_RESET, () => {
        console.log("[HudSyncSystem] GAME_RESET received! Resetting stores.");
        resetAllStores();
        overlayStore.loadStats();
        this.lastTetherLength = 0.0;
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
        store.setTraversalHint("RELEASE TO FLING", "rgb(245, 158, 11)", 1);
        break;
      case "maxout":
        store.setTraversalHint("MAX TENSION — FLING NOW", "rgb(239, 68, 68)", 1);
        break;
    }
  }

  public dispose(): void {
    this.subscriptions.forEach((u) => u());
    this.subscriptions = [];
  }
}
