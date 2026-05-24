import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";

type HintLevel = "none" | "charging" | "ready" | "maxout";

export class DomHudSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private unsubscribes: (() => void)[] = [];
  private tensionBar: HTMLElement | null = null;
  private tensionText: HTMLElement | null = null;
  private playerHpText: HTMLElement | null = null;
  private weaverHpBar: HTMLElement | null = null;
  private weaverHpValue: HTMLElement | null = null;
  private weaverStateText: HTMLElement | null = null;
  private traversalHint: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private overlayTitle: HTMLElement | null = null;
  private overlaySubtitle: HTMLElement | null = null;
  private pauseOverlay: HTMLElement | null = null;
  private lastHintLevel: HintLevel = "none";
  private currentState: string = "AIRBORNE";
  private lastTensionPercent = -1;

  private playerHpLeds: (HTMLElement | null)[] = [];

  constructor(private broker: EventBroker) {}

  public init(): void {
    this.cacheDomElements();
    this.registerSubscriptions();
  }

  private cacheDomElements(): void {
    if (typeof document === "undefined") return;
    this.tensionBar = document.getElementById("tension-meter-bar");
    this.tensionText = document.getElementById("tension-meter-text");
    this.playerHpText = document.getElementById("player-hp-text");
    this.weaverHpBar = document.getElementById("weaver-hp-bar");
    this.weaverHpValue = document.getElementById("weaver-hp-value");
    this.weaverStateText = document.getElementById("weaver-state-text");
    this.traversalHint = document.getElementById("traversal-hint");
    this.overlay = document.getElementById("game-state-overlay");
    this.overlayTitle = document.getElementById("game-state-title");
    this.overlaySubtitle = document.getElementById("game-state-subtitle");
    this.pauseOverlay = document.getElementById("pause-overlay");

    this.playerHpLeds = [];
    for (let i = 0; i < 5; i++) {
      this.playerHpLeds.push(document.getElementById(`player-hp-led-${i}`));
    }
  }

  private registerSubscriptions(): void {
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.SILK_TENSION_CHANGE, ({ tension }) => {
        this.updateTensionBar(tension);
        this.updateHint(tension);
      })
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.PLAYER_STATE_CHANGE, ({ state }) => {
        this.currentState = state;
        if (state !== "WALL_SLIDING") {
          this.setHint("none");
        }
      })
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.PLAYER_HEALTH_CHANGED, ({ hp, maxHp }) => {
        this.updatePlayerHp(hp, maxHp);
      })
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.WEAVER_HEALTH_CHANGED, ({ hp, maxHp }) => {
        this.updateWeaverHp(hp, maxHp);
      })
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.WEAVER_STATE_CHANGE, ({ state, hue }) => {
        this.updateWeaverStateLabel(state, hue);
      })
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.GAME_OVER, () => {
        this.showOverlay("DEFEATED", "rgb(239, 68, 68)", "The line was severed.");
      })
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.GAME_WIN, () => {
        this.showOverlay("VICTORY", "rgb(16, 185, 129)", "The shaft is clear.");
      })
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.hideOverlay();
        if (this.pauseOverlay) this.pauseOverlay.style.display = "none";
        this.setHint("none");
      })
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.GAME_PAUSED, ({ isPaused }) => {
        if (this.pauseOverlay) {
          this.pauseOverlay.style.display = isPaused ? "flex" : "none";
        }
      })
    );
  }

  private updateTensionBar(tension: number): void {
    const snapLimit = 1.3;
    const clamped = Math.max(0, Math.min(snapLimit, tension));
    const displayPercent = Math.round(clamped * 100);

    if (this.tensionBar) {
      const scaleX = clamped / snapLimit;
      this.tensionBar.style.transform = `scaleX(${scaleX.toFixed(3)})`;
      
      if (clamped >= 1.0) {
        this.tensionBar.style.backgroundColor = "rgb(239, 68, 68)";
      } else if (clamped >= 0.75) {
        this.tensionBar.style.backgroundColor = "rgb(245, 158, 11)";
      } else {
        this.tensionBar.style.backgroundColor = "rgb(16, 185, 129)";
      }
    }

    if (displayPercent !== this.lastTensionPercent) {
      this.lastTensionPercent = displayPercent;
      if (this.tensionText) {
        this.tensionText.textContent = displayPercent + "%";
        this.tensionText.style.color = clamped >= 1.0 ? "rgb(239, 68, 68)" : clamped >= 0.75 ? "rgb(245, 158, 11)" : "rgb(244, 244, 245)";
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

  private setHint(level: HintLevel): void {
    if (!this.traversalHint || level === this.lastHintLevel) return;
    this.lastHintLevel = level;
    switch (level) {
      case "none":
        this.traversalHint.style.opacity = "0";
        this.traversalHint.textContent = "";
        break;
      case "charging":
        this.traversalHint.style.opacity = "1";
        this.traversalHint.style.color = "rgb(161, 161, 170)";
        this.traversalHint.textContent = "HOLD — CHARGING SILK";
        break;
      case "ready":
        this.traversalHint.style.opacity = "1";
        this.traversalHint.style.color = "rgb(245, 158, 11)";
        this.traversalHint.textContent = "RELEASE TO FLING";
        break;
      case "maxout":
        this.traversalHint.style.opacity = "1";
        this.traversalHint.style.color = "rgb(239, 68, 68)";
        this.traversalHint.textContent = "MAX TENSION — FLING NOW";
        break;
    }
  }

  private updatePlayerHp(hp: number, maxHp: number): void {
    if (this.playerHpText) {
      this.playerHpText.textContent = `${hp} / ${maxHp}`;
    }
    for (let i = 0; i < 5; i++) {
      const led = this.playerHpLeds[i];
      if (led) {
        if (i < hp) {
          led.className = "hp-block hp-active";
        } else {
          led.className = "hp-block";
        }
      }
    }
  }

  private updateWeaverHp(hp: number, maxHp: number): void {
    if (this.weaverHpValue) {
      this.weaverHpValue.textContent = `${hp}/${maxHp}`;
    }
    if (this.weaverHpBar) {
      const ratio = Math.max(0, hp / maxHp);
      this.weaverHpBar.style.transform = `scaleX(${ratio.toFixed(3)})`;
      this.weaverHpBar.style.backgroundColor =
        hp <= maxHp * 0.3 ? "rgb(245, 158, 11)" : "rgb(239, 68, 68)";
    }
  }

  private updateWeaverStateLabel(state: string, hue: string): void {
    if (this.weaverStateText) {
      this.weaverStateText.textContent = state.toUpperCase();
      this.weaverStateText.style.color = hue;
    }
  }

  private showOverlay(layoutTheme: string, color: string, subText: string): void {
    if (this.overlay) this.overlay.style.display = "flex";
    if (this.overlayTitle) {
      this.overlayTitle.textContent = layoutTheme;
      this.overlayTitle.style.color = color;
    }
    if (this.overlaySubtitle) {
      this.overlaySubtitle.textContent = subText;
    }
  }

  private hideOverlay(): void {
    if (this.overlay) this.overlay.style.display = "none";
  }

  public dispose(): void {
    this.unsubscribes.forEach((u) => u());
    this.unsubscribes = [];
    this.tensionBar = null;
    this.tensionText = null;
    this.playerHpText = null;
    this.weaverHpBar = null;
    this.weaverHpValue = null;
    this.weaverStateText = null;
    this.traversalHint = null;
    this.overlay = null;
    this.overlayTitle = null;
    this.overlaySubtitle = null;
    this.pauseOverlay = null;
    this.playerHpLeds = [];
  }
}
