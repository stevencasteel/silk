import { IEventBroker } from "../../contracts/ICore";
import { GameEvent } from "../events/GameEvents";

export class PauseHandler {
  private isManuallyPaused: boolean = false;
  private gameStarted: boolean = false;

  constructor(private broker: IEventBroker, private onPausedChange: (paused: boolean) => void) {}

  public init(): void {
    window.addEventListener("keydown", this.handleKeyDown);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
  }

  public setPaused(paused: boolean): void {
    if (!paused && !this.gameStarted) {
      return;
    }
    this.onPausedChange(paused);
    this.broker.publish(GameEvent.GAME_PAUSED, { isPaused: paused });
  }

  public resumeFromGesture(): void {
    this.gameStarted = true;
    this.setPaused(false);
    this.isManuallyPaused = false;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.gameStarted) return;
    if (e.code === "KeyP") {
      e.preventDefault();
      this.isManuallyPaused = !this.isManuallyPaused;
      this.setPaused(this.isManuallyPaused);
    }
  };

  private handleVisibilityChange = (): void => {
    if (!this.gameStarted) return;
    if (document.hidden) {
      this.setPaused(true);
    } else {
      if (this.isManuallyPaused) return;
      this.setPaused(false);
    }
  };
}
