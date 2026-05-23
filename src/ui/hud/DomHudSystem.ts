import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";

export class DomHudSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private unsubscribes: (() => void)[] = [];
  private tensionBar: HTMLElement | null = null;
  private tensionText: HTMLElement | null = null;
  private hpText: HTMLElement | null = null;
  private hpValue: HTMLElement | null = null;
  private bossStateText: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private overlayTitle: HTMLElement | null = null;

  constructor(private broker: EventBroker) {}

  public init(): void {
    this.cacheDomElements();
    this.registerSubscribers();
  }

  public update(_dt: number): void {
    void _dt;
  }

  private cacheDomElements(): void {
    if (typeof document === "undefined") return;
    this.tensionBar = document.getElementById("tension-meter-bar");
    this.tensionText = document.getElementById("tension-meter-text");
    this.hpText = document.getElementById("player-hp-bar");
    this.hpValue = document.getElementById("player-hp-value");
    this.bossStateText = document.getElementById("boss-state-text");
    this.overlay = document.getElementById("game-state-overlay");
    this.overlayTitle = document.getElementById("game-state-title");
  }

  private registerSubscribers(): void {
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.ROPE_TENSION_CHANGE, (payload) => this.updateTensionDisplay(payload.tension))
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.PLAYER_HEALTH_CHANGED, (payload) => this.updateHealthDisplay(payload.hp, payload.maxHp))
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.WARDEN_STATE_CHANGE, (payload) => this.updateWardenStateDisplay(payload.state, payload.hue))
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.GAME_OVER, () => this.showOverlay("TETHER SNAPPED", "#ef4444"))
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.GAME_RESET, () => this.hideOverlay())
    );
  }

  private updateTensionDisplay(value: number): void {
    const clamped = Math.max(0, Math.min(1.5, value));
    const percentage = Math.min(100, clamped * 100).toFixed(1) + "%";
    if (this.tensionBar) {
      this.tensionBar.style.width = percentage;
      if (clamped > 1.1) {
        this.tensionBar.style.backgroundColor = "#ef4444";
      } else if (clamped > 0.9) {
        this.tensionBar.style.backgroundColor = "#eab308";
      } else {
        this.tensionBar.style.backgroundColor = "#22c55e";
      }
    }
    if (this.tensionText) {
      this.tensionText.textContent = `TETHER LOAD: ${percentage}`;
    }
  }

  private updateHealthDisplay(hp: number, maxHp: number): void {
    if (this.hpValue) {
      this.hpValue.textContent = `INTEGRITY: ${hp} / ${maxHp}`;
    }
    if (this.hpText) {
      const hpPct = ((hp / maxHp) * 100).toFixed(0) + "%";
      this.hpText.style.width = hpPct;
      this.hpText.style.backgroundColor = hp <= 1 ? "#ef4444" : "#22c55e";
    }
  }

  private updateWardenStateDisplay(state: string, hue: string): void {
    if (this.bossStateText) {
      this.bossStateText.textContent = `WARDEN: ${state.toUpperCase()}`;
      this.bossStateText.style.color = hue;
    }
  }

  private showOverlay(title: string, color: string): void {
    if (this.overlay) this.overlay.style.display = "flex";
    if (this.overlayTitle) {
      this.overlayTitle.textContent = title;
      this.overlayTitle.style.color = color;
      this.overlayTitle.style.textShadow = `0 0 20px ${color}80`;
    }
  }

  private hideOverlay(): void {
    if (this.overlay) this.overlay.style.display = "none";
  }

  public dispose(): void {
    this.unsubscribes.forEach((unsub) => unsub());
    this.unsubscribes = [];
  }
}
