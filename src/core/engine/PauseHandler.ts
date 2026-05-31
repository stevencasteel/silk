import { IEventBroker } from "../../contracts/ICore";
import { GameEvent } from "../events/GameEvents";

export class PauseHandler {
  private isManuallyPaused: boolean = false;

  constructor(private broker: IEventBroker, private onPausedChange: (paused: boolean) => void) {}

  public init(): void {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("blur", this.handleBlur);
    window.addEventListener("focus", this.handleFocus);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("blur", this.handleBlur);
    window.removeEventListener("focus", this.handleFocus);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
  }

  public setPaused(paused: boolean): void {
    this.onPausedChange(paused);
    this.broker.publish(GameEvent.GAME_PAUSED, { isPaused: paused });
  }

  public resumeFromGesture(): void {
    this.setPaused(false);
    this.isManuallyPaused = false;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "KeyP") {
      e.preventDefault();
      this.isManuallyPaused = !this.isManuallyPaused;
      this.setPaused(this.isManuallyPaused);
    }
  };

  private handleBlur = (): void => {
    this.setPaused(true);
  };

  private handleFocus = (): void => {
    if (this.isManuallyPaused) return;
    this.setPaused(false);
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.setPaused(true);
    } else {
      if (this.isManuallyPaused) return;
      this.setPaused(false);
    }
  };
}
