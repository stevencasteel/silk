import { GameLoop } from "../loop/GameLoop";
import { EventBroker } from "../events/EventBroker";
import { SystemManager } from "../systems/SystemManager";
import { IClock } from "../clock/IClock";
import { IScheduler } from "../loop/IScheduler";
import { GameEvent } from "../events/GameEvents";

export class Engine {
  private loop: GameLoop;
  private systemManager: SystemManager;
  private broker: EventBroker;

  public isPaused: boolean = false;

  constructor(
    _canvas: HTMLCanvasElement,
    broker: EventBroker,
    systemManager: SystemManager,
    clock: IClock,
    scheduler: IScheduler
  ) {
    this.broker = broker;
    this.systemManager = systemManager;
    this.loop = new GameLoop(
      (dt) => this.update(dt),
      (alpha) => this.render(alpha),
      clock,
      scheduler
    );
  }

  public async start(): Promise<void> {
    await this.systemManager.initAll();
    this.initPauseHandlers();
    this.loop.start();
  }

  public stop(): void {
    this.loop.stop();
    this.removePauseHandlers();
    this.systemManager.disposeAll();
  }

  public setPaused(paused: boolean): void {
    if (this.isPaused === paused) return;
    this.isPaused = paused;
    this.broker.publish(GameEvent.GAME_PAUSED, { isPaused: this.isPaused });
  }

  private initPauseHandlers(): void {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("blur", this.handleBlur);
    window.addEventListener("focus", this.handleFocus);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private removePauseHandlers(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("blur", this.handleBlur);
    window.removeEventListener("focus", this.handleFocus);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "KeyP") {
      e.preventDefault();
      this.setPaused(!this.isPaused);
    }
  };

  private handleBlur = (): void => {
    this.setPaused(true);
  };

  private handleFocus = (): void => {
    this.setPaused(false);
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.setPaused(true);
    } else {
      this.setPaused(false);
    }
  };

  private update(dt: number): void {
    if (this.isPaused) return;
    this.systemManager.updateAll(dt);
  }

  private render(alpha: number): void {
    this.systemManager.renderAll(alpha);
  }
}
