import { GameLoop } from "../loop/GameLoop";
import { IEventBroker } from "../../contracts/ICore";
import { SystemManager } from "../systems/SystemManager";
import { IClock } from "../clock/IClock";
import { IScheduler } from "../loop/IScheduler";
import { GameEvent } from "../events/GameEvents";
import { RuntimeState } from "./RuntimeState";
import { PauseHandler } from "./PauseHandler";
import { ISystem } from "../../contracts/ISystem";
import * as BABYLON from "@babylonjs/core";

interface SystemManagerPrivateAccess {
  systems: ISystem[];
}

interface RenderSystemPrivateAccess {
  scene: BABYLON.Scene | null;
  engine: BABYLON.Engine | null;
}

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

  private verifySystemsReady(): boolean {
    try {
      if (!this.systemManager) return false;

      const manager = this.systemManager as unknown as SystemManagerPrivateAccess;
      if (!manager.systems) return false;

      const renderSystem = manager.systems.find(
        (s) => s.constructor.name === "RenderSystem"
      ) as unknown as RenderSystemPrivateAccess | undefined;
      
      if (!renderSystem) return false;

      const scene = renderSystem.scene;
      if (!scene) return false;

      if (!scene.isReady()) {
        return false;
      }

      if (!scene.activeCamera) {
        return false;
      }

      return true;
    } catch (err) {
      console.warn("Pre-flight system check warning:", err);
      return false;
    }
  }

  public async start(): Promise<void> {
    try {
      this.isPaused = true;
      this.broker.publish(GameEvent.GAME_BOOT_PROGRESS, { status: "Starting engine...", progress: 0, phase: 0 });

      await this.systemManager.initAll((phase, systemName, progress) => {
        const readableName = systemName.replace(/System$/, '').replace(/([A-Z])/g, ' $1').trim();
        this.broker.publish(GameEvent.GAME_BOOT_PROGRESS, {
          status: `Loading ${readableName}...`,
          progress: progress * 0.9,
          phase: phase
        });
      });

      this.pauseHandler.init();
      this.initGestureHandlers();

      let verified = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        if (this.verifySystemsReady()) {
          verified = true;
          break;
        }
        this.broker.publish(GameEvent.GAME_BOOT_PROGRESS, {
          status: `Verifying systems (Attempt ${attempt + 1}/10)...`,
          progress: 0.9 + (attempt / 10) * 0.1,
          phase: 3
        });
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      if (!verified) {
        console.warn("[Engine Pre-flight] Systems ready check timed out, proceeding with fallback.");
      }

      const manager = this.systemManager as unknown as SystemManagerPrivateAccess;
      if (manager.systems) {
        const renderSystem = manager.systems.find(
          (s) => s.constructor.name === "RenderSystem"
          ) as unknown as RenderSystemPrivateAccess | undefined;
        
        if (renderSystem) {
          const scene = renderSystem.scene;
          const engine = renderSystem.engine;
          if (scene && engine) {
            for (let i = 0; i < 3; i++) {
              engine.beginFrame();
              scene.render();
              engine.endFrame();
            }
          }
        }
      }

      this.broker.publish(GameEvent.GAME_BOOT_PROGRESS, { status: "READY", progress: 1, phase: 4 });

      this.loop.start();
    } catch (error) {
      console.error("Critical error during engine startup:", error);
      const errMsg = "BOOT FAILED: " + (error instanceof Error ? error.message : String(error));
      this.broker.publish(GameEvent.GAME_BOOT_PROGRESS, {
        status: errMsg,
        progress: 0,
        phase: 0
      });
    }
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
    if (this.isPaused || !this.gameStarted || this.runtime.gameFinished) return;

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
