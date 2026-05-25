import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { useHudStore } from "./hudStore";

export class DomHudSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private subscriptions: (() => void)[] = [];
  private lastHintLevel: "none" | "charging" | "ready" | "maxout" = "none";
  private currentState: string = "AIRBORNE";

  private tensionFill: HTMLElement | null = null;
  private tensionText: HTMLElement | null = null;
  private weaverFill: HTMLElement | null = null;
  private weaverText: HTMLElement | null = null;
  private weaverStateText: HTMLElement | null = null;

  constructor(private broker: EventBroker) {}

  public init(): void {
    this.registerSubscriptions();
  }

  private getElements(): boolean {
    if (this.tensionFill && this.tensionText && this.weaverFill && this.weaverText && this.weaverStateText) {
      return true;
    }
    this.tensionFill = document.getElementById("hud-tension-fill");
    this.tensionText = document.getElementById("hud-tension-text");
    this.weaverFill = document.getElementById("hud-weaver-fill");
    this.weaverText = document.getElementById("hud-weaver-text");
    this.weaverStateText = document.getElementById("hud-weaver-state-text");
    return !!(this.tensionFill && this.tensionText && this.weaverFill && this.weaverText && this.weaverStateText);
  }

  private registerSubscriptions(): void {
    const store = useHudStore.getState();

    this.subscriptions.push(
      this.broker.subscribe(GameEvent.TETHER_TENSION_CHANGE, ({ tension }) => {
        this.updateHint(tension);
        this.updateTensionDom(tension);
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
        this.updateWeaverHealthDom(hp, maxHp);
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.WEAVER_STATE_CHANGE, ({ state, hue }) => {
        this.updateWeaverStateDom(state, hue);
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
        this.updateTensionDom(0.0);
        this.updateWeaverHealthDom(100, 100);
        this.updateWeaverStateDom("SWEEPING", "rgb(239, 68, 68)");
      })
    );
    this.subscriptions.push(
      this.broker.subscribe(GameEvent.GAME_PAUSED, ({ isPaused }) => {
        store.setPaused(isPaused);
      })
    );
  }

  private updateTensionDom(tension: number): void {
    if (!this.getElements()) return;
    const snapLimit = 1.3;
    const clampedTension = Math.max(0, Math.min(snapLimit, tension));
    const displayTensionPercent = Math.round(clampedTension * 100);
    const tensionScaleX = clampedTension / snapLimit;

    let tensionBarColor = "rgb(16, 185, 129)";
    let tensionTextColor = "rgb(244, 244, 245)";
    if (clampedTension >= 1.0) {
      tensionBarColor = "rgb(239, 68, 68)";
      tensionTextColor = "rgb(239, 68, 68)";
    } else if (clampedTension >= 0.75) {
      tensionBarColor = "rgb(245, 158, 11)";
      tensionTextColor = "rgb(245, 158, 11)";
    }

    if (this.tensionFill) {
      this.tensionFill.style.transform = `scaleX(${tensionScaleX.toFixed(3)})`;
      this.tensionFill.style.backgroundColor = tensionBarColor;
    }
    if (this.tensionText) {
      this.tensionText.textContent = `${displayTensionPercent}%`;
      this.tensionText.style.color = tensionTextColor;
    }
  }

  private updateWeaverHealthDom(hp: number, maxHp: number): void {
    if (!this.getElements()) return;
    const weaverHpRatio = Math.max(0, hp / maxHp);
    const weaverHpBarColor = hp <= maxHp * 0.3 ? "rgb(245, 158, 11)" : "rgb(239, 68, 68)";

    if (this.weaverFill) {
      this.weaverFill.style.transform = `scaleX(${weaverHpRatio.toFixed(3)})`;
      this.weaverFill.style.backgroundColor = weaverHpBarColor;
    }
    if (this.weaverText) {
      this.weaverText.textContent = `${hp}/${maxHp}`;
    }
  }

  private updateWeaverStateDom(state: string, hue: string): void {
    if (!this.getElements()) return;
    if (this.weaverStateText) {
      this.weaverStateText.textContent = state.toUpperCase();
      this.weaverStateText.style.color = hue;
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
    const store = useHudStore.getState();
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
    this.tensionFill = null;
    this.tensionText = null;
    this.weaverFill = null;
    this.weaverText = null;
    this.weaverStateText = null;
  }
}
