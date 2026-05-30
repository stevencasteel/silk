import { GameLoop } from "../loop/GameLoop";
import { IEventBroker } from "../../contracts/ICore";
import { SystemManager } from "../systems/SystemManager";
import { IClock } from "../clock/IClock";
import { IScheduler } from "../loop/IScheduler";
import { GameEvent } from "../events/GameEvents";
import { EngineTime } from "./EngineTime";

export class Engine {
  private loop: GameLoop;
  private systemManager: SystemManager;
  private broker: IEventBroker;

  public isPaused: boolean = true;
  private isManuallyPaused: boolean = false;
  private unsubscribes: (() => void)[] = [];

  constructor(
    _canvas: HTMLCanvasElement,
    broker: IEventBroker,
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
    this.isPaused = true;
    this.broker.publish(GameEvent.GAME_BOOT_PROGRESS, { status: "READY" });
    await this.systemManager.initAll();

    this.initPauseHandlers();
    this.initGestureHandlers();

    this.loop.start();
  }

  public stop(): void {
    this.loop.cleanup();
    this.removePauseHandlers();
    this.systemManager.disposeAll();
    for (let i = 0; i < this.unsubscribes.length; i++) {
      this.unsubscribes[i]();
    }
    this.unsubscribes.length = 0;
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

  private initGestureHandlers(): void {
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.USER_GESTURE_REGISTERED, () => {
        this.setPaused(false);
        this.isManuallyPaused = false;
      })
    );
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

  private update(dt: number): void {
    if (this.isPaused) return;

    EngineTime.update(dt);
    const isHitStop = EngineTime.isHitStop;
    const scaledDt = dt * EngineTime.activeTimeScale;

    this.systemManager.updateAll(scaledDt, isHitStop);
  }

  private render(alpha: number): void {
    this.systemManager.renderAll(alpha);
  }
}
