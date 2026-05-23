import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";

export class DomHudSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private unsubscribes: (() => void)[] = [];
  private tensionBar: HTMLElement | null = null;
  private tensionText: HTMLElement | null = null;
  private speedBar: HTMLElement | null = null;
  private speedText: HTMLElement | null = null;
  private hpText: HTMLElement | null = null;
  private hpValue: HTMLElement | null = null;
  private bossStateText: HTMLElement | null = null;
  private bossPhaseText: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private overlayTitle: HTMLElement | null = null;

  constructor(private broker: EventBroker) {}

  public init(): void {
    this.cacheDomElements();
    this.registerSubscribers();
  }

  public update(_dt: number): void {}

  private cacheDomElements(): void {
    if (typeof document === "undefined") return;
    this.tensionBar = document.getElementById("tension-meter-bar");
    this.tensionText = document.getElementById("tension-meter-text");
    this.speedBar = document.getElementById("speedometer-bar");
    this.speedText = document.getElementById("speedometer-text");
    this.hpText = document.getElementById("player-hp-bar");
    this.hpValue = document.getElementById("player-hp-value");
    this.bossStateText = document.getElementById("boss-state-text");
    this.bossPhaseText = document.getElementById("boss-state-phase");
    this.overlay = document.getElementById("game-state-overlay");
    this.overlayTitle = document.getElementById("game-state-title");
  }

  private registerSubscribers(): void {
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.ROPE_TENSION_CHANGE, (payload) => this.updateTensionDisplay(payload.tension))
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.PLAYER_VELOCITY_CHANGED, (payload) => this.updateVelocityDisplay(payload.velocity, payload.maxVelocity))
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.PLAYER_HEALTH_CHANGED, (payload) => this.updateHealthDisplay(payload.hp, payload.maxHp))
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.WARDEN_STATE_CHANGE, (payload) => this.updateWardenStateDisplay(payload.state, payload.hue))
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.GAME_OVER, () => this.showOverlay("GAME OVER", "#ef4444"))
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.GAME_WIN, () => this.showOverlay("VICTORY", "#22c55e"))
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.GAME_RESET, () => this.hideOverlay())
    );
  }

  private updateTensionDisplay(value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    const percentage = (clamped * 100).toFixed(1) + "%";
    if (this.tensionBar) {
      this.tensionBar.style.width = percentage;
      if (clamped > 0.8) this.tensionBar.style.backgroundColor = "var(--signal-red, #ef4444)";
      else if (clamped > 0.5) this.tensionBar.style.backgroundColor = "var(--signal-yellow, #eab308)";
      else this.tensionBar.style.backgroundColor = "var(--signal-green, #22c55e)";
    }
    if (this.tensionText) this.tensionText.textContent = `TENSION: ${percentage}`;
  }

  private updateVelocityDisplay(velocity: number, maxVelocity: number): void {
    const ratio = maxVelocity > 0 ? Math.max(0, Math.min(1, velocity / maxVelocity)) : 0;
    const percentage = (ratio * 100).toFixed(0) + "%";
    if (this.speedBar) this.speedBar.style.width = percentage;
    if (this.speedText) this.speedText.textContent = `VELOCITY: ${velocity.toFixed(0)} / ${maxVelocity.toFixed(0)} m/s`;
  }

  private updateHealthDisplay(hp: number, maxHp: number): void {
    if (this.hpValue) this.hpValue.textContent = `HP: ${hp} / ${maxHp}`;
    if (this.hpText) {
      const hpPct = ((hp / maxHp) * 100).toFixed(0) + "%";
      this.hpText.style.width = hpPct;
      this.hpText.style.backgroundColor = hp <= 1 ? "var(--signal-red, #ef4444)" : "var(--signal-green, #22c55e)";
    }
  }

  private updateWardenStateDisplay(state: string, hue: string): void {
    if (this.bossStateText) {
      this.bossStateText.textContent = `WARDEN: ${state.toUpperCase()}`;
      this.bossStateText.style.color = hue;
    }
    if (this.bossPhaseText) {
      this.bossPhaseText.style.borderColor = hue;
      this.bossPhaseText.style.color = hue;
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
