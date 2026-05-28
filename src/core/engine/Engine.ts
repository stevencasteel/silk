import { GameLoop } from "../loop/GameLoop";
import { EventBroker } from "../events/EventBroker";
import { SystemManager } from "../systems/SystemManager";
import { IClock } from "../clock/IClock";
import { IScheduler } from "../loop/IScheduler";
import { GameEvent } from "../events/GameEvents";
import { GameDirectorSystem } from "../../gameplay/combat/GameDirectorSystem";
import { GAMEPLAY_TUNING } from "./ArenaConfig";

export class Engine {
  private loop: GameLoop;
  private systemManager: SystemManager;
  private broker: EventBroker;

  public isPaused: boolean = true;
  private isManuallyPaused: boolean = false;
  private hitStopTimer: number = 0;
  private unsubscribes: (() => void)[] = [];

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
    this.isPaused = true;
    this.broker.publish(GameEvent.GAME_BOOT_PROGRESS, { status: "READY" });
    await this.systemManager.initAll();

    this.initPauseHandlers();
    this.initHitStopHandlers();
    this.initGestureHandlers();

    this.loop.start();
  }

  public stop(): void {
    this.loop.cleanup();
    this.removePauseHandlers();
    this.removeHitStopHandlers();
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

  private initHitStopHandlers(): void {
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.PLAYER_DAMAGED, () => {
        this.hitStopTimer = GAMEPLAY_TUNING.COMBAT.HITSTOP_PLAYER;
      })
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.WEAVER_DAMAGED, () => {
        this.hitStopTimer = GAMEPLAY_TUNING.COMBAT.HITSTOP_WEAVER;
      })
    );
    // Micro-Freeze Impact: Satisfying 0.04-second hit-stop when projectile is smashed
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.PROJECTILE_IMPACT, (payload) => {
        if (!payload.isWall) {
          this.hitStopTimer = 0.04;
        }
      })
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.hitStopTimer = 0;
      })
    );
  }

  private initGestureHandlers(): void {
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.USER_GESTURE_REGISTERED, () => {
        this.setPaused(false);
        this.isManuallyPaused = false;
      })
    );
  }

  private removeHitStopHandlers(): void {
    this.unsubscribes.forEach((unsub) => unsub());
    this.unsubscribes = [];
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

    let isHitStop = false;
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      isHitStop = true;
    }

    const scaledDt = dt * GameDirectorSystem.timeScale;
    this.systemManager.updateAll(scaledDt, isHitStop);
  }

  private render(alpha: number): void {
    this.systemManager.renderAll(alpha);
  }
}
