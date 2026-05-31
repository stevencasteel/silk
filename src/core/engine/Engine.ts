import { GameLoop } from "../loop/GameLoop";
import { IEventBroker } from "../../contracts/ICore";
import { SystemManager } from "../systems/SystemManager";
import { IClock } from "../clock/IClock";
import { IScheduler } from "../loop/IScheduler";
import { GameEvent } from "../events/GameEvents";
import { RuntimeState } from "./RuntimeState";
import { PauseHandler } from "./PauseHandler";

export class Engine {
  private loop: GameLoop;
  private systemManager: SystemManager;
  private broker: IEventBroker;
  private runtime: RuntimeState;
  private pauseHandler: PauseHandler;

  public isPaused: boolean = true;
  public gameStarted: boolean = false;
  private unsubscribes: (() => void)[] = [];
  public _bootProgressUnsubscribe?: () => void;

  public get eventBroker(): IEventBroker {
    return this.broker;
  }

  constructor(
    _canvas: HTMLCanvasElement,
    broker: IEventBroker,
    systemManager: SystemManager,
    clock: IClock,
    scheduler: IScheduler,
    runtime: RuntimeState
  ) {
    this.broker = broker;
    this.systemManager = systemManager;
    this.runtime = runtime;
    this.pauseHandler = new PauseHandler(broker, (paused) => {
      this.isPaused = paused;
    });
    this.loop = new GameLoop(
      (dt) => this.update(dt),
      (alpha) => this.render(alpha),
      clock,
      scheduler
    );
  }

  public async start(): Promise<void> {
    this.isPaused = true;
    this.broker.publish(GameEvent.GAME_BOOT_PROGRESS, { status: "INITIALIZING SYSTEMS..." });

    await this.systemManager.initAll((phase, systemName, progress) => {
      const phaseNames = ["BOOTSTRAP", "WORLD", "GAMEPLAY", "UI"];
      const progressPercent = Math.round(progress * 100);
      this.broker.publish(GameEvent.GAME_BOOT_PROGRESS, {
        status: `[${phaseNames[phase]}] ${systemName}... (${progressPercent}%)`
      });
    });

    this.broker.publish(GameEvent.GAME_BOOT_PROGRESS, { status: "READY" });

    this.pauseHandler.init();
    this.initGestureHandlers();

    this.loop.start();
  }

  public stop(): void {
    this.loop.cleanup();
    this.pauseHandler.dispose();
    this.systemManager.disposeAll();
    for (let i = 0; i < this.unsubscribes.length; i++) {
      this.unsubscribes[i]();
    }
    this.unsubscribes.length = 0;
  }

  public setPaused(paused: boolean): void {
    this.pauseHandler.setPaused(paused);
  }

  private initGestureHandlers(): void {
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.USER_GESTURE_REGISTERED, () => {
        this.gameStarted = true;
        this.runtime.gameStarted = true;
        this.broker.publish(GameEvent.GAME_STARTED, undefined);
        this.pauseHandler.resumeFromGesture();
      })
    );
  }

  private update(dt: number): void {
    if (this.isPaused) return;

    if (this.runtime.hitLagTimer > 0) {
      this.runtime.hitLagTimer = Math.max(0, this.runtime.hitLagTimer - dt);
    }
    const scaledDt = dt * this.runtime.activeTimeScale;

    this.systemManager.updateAll(scaledDt);
  }

  private render(alpha: number): void {
    this.systemManager.renderAll(alpha);
  }
}
