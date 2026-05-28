import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../engine/SystemContext";
import { GameEvent } from "../events/GameEvents";
import { SubscriptionTracker } from "../utils/EngineUtils";
import { useOverlayStore } from "../../ui/hud/hudStore";

export class ProfilePersistenceSystem implements ISystem {
  readonly phase = SystemPhase.PostRender;
  readonly initPhase = InitPhase.UI;

  private _tracker = new SubscriptionTracker();
  private wins = 0;
  private losses = 0;

  constructor(private context: SystemContext) {}

  public init(): void {
    this.loadStats();

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_OVER, () => {
        this.recordLoss();
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_WIN, () => {
        this.recordWin();
      })
    );

    window.addEventListener("silk-clear-stats", this.handleClearStats);
  }

  private loadStats(): void {
    try {
      const raw = localStorage.getItem("silk_stats");
      if (raw) {
        const parsed = JSON.parse(raw);
        this.wins = typeof parsed.wins === "number" ? parsed.wins : 0;
        this.losses = typeof parsed.losses === "number" ? parsed.losses : 0;
      }
    } catch (e) {
      console.warn("ProfilePersistenceSystem: Failed to load local stats", e);
    }
    useOverlayStore.getState().setStats(this.wins, this.losses);
  }

  private recordWin(): void {
    this.wins++;
    this.saveStats();
  }

  private recordLoss(): void {
    this.losses++;
    this.saveStats();
  }

  private saveStats(): void {
    try {
      localStorage.setItem("silk_stats", JSON.stringify({ wins: this.wins, losses: this.losses }));
    } catch (e) {
      console.warn("ProfilePersistenceSystem: Failed to save stats", e);
    }
    useOverlayStore.getState().setStats(this.wins, this.losses);
  }

  private handleClearStats = () => {
    this.wins = 0;
    this.losses = 0;
    try {
      localStorage.setItem("silk_stats", JSON.stringify({ wins: 0, losses: 0 }));
    } catch (e) {
      console.warn("ProfilePersistenceSystem: Failed to clear stats", e);
    }
    useOverlayStore.getState().setStats(0, 0);
  };

  public dispose(): void {
    this._tracker.clear();
    window.removeEventListener("silk-clear-stats", this.handleClearStats);
  }
}
