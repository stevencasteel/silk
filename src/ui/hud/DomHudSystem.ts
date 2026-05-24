import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { useHudStore } from "./hudStore";

type HintLevel = "none" | "charging" | "ready" | "maxout";

export class DomHudSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private subscriptions: (() => void)[] = [];
  private lastHintLevel: HintLevel = "none";
  private currentState: string = "AIRBORNE";

  constructor(private broker: EventBroker) {}

  public init(): void {
    this.registerSubscriptions();
  }

  private registerSubscriptions(): void {
    const store = useHudStore.getState();

    this.subscriptions.push(
      this.broker.subscribe(GameEvent.SILK_TENSION_CHANGE, ({ tension }) => {
        store.setTension(tension);
        this.updateHint(tension);
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.PLAYER_STATE_CHANGE, ({ state }) => {
        this.currentState = state;
        store.setCurrentState(state);
        if (state !== "WALL_SLIDING") {
          this.setHint("none");
        }
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.PLAYER_HEALTH_CHANGED, ({ hp, maxHp }) => {
        store.setPlayerHp(hp, maxHp);
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.WEAVER_HEALTH_CHANGED, ({ hp, maxHp }) => {
        store.setWeaverHp(hp, maxHp);
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.WEAVER_STATE_CHANGE, ({ state, hue }) => {
        store.setWeaverState(state, hue);
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.GAME_OVER, () => {
        store.showOverlay("DEFEATED", "rgb(239, 68, 68)", "The line was severed.");
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.GAME_WIN, () => {
        store.showOverlay("VICTORY", "rgb(16, 185, 129)", "The shaft is clear.");
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.GAME_RESET, () => {
        store.hideOverlay();
        store.setPaused(false);
        this.setHint("none");
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.GAME_PAUSED, ({ isPaused }) => {
        store.setPaused(isPaused);
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

  private setHint(level: HintLevel): void {
    if (level === this.lastHintLevel) return;
    this.lastHintLevel = level;
    const store = useHudStore.getState();
    switch (level) {
      case "none":
        store.setTraversalHint("", "rgb(161, 161, 170)", 0);
        break;
      case "charging":
        store.setTraversalHint("HOLD — CHARGING SILK", "rgb(161, 161, 170)", 1);
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
