import { GameLoop } from "../loop/GameLoop";
import { EventBroker } from "../events/EventBroker";
import { SystemManager } from "../systems/SystemManager";
import { IClock } from "../clock/IClock";
import { IScheduler } from "../loop/IScheduler";

export class Engine {
  private loop: GameLoop;
  private systemManager: SystemManager;

  constructor(
    _canvas: HTMLCanvasElement, 
    _broker: EventBroker, 
    systemManager: SystemManager,
    clock: IClock,
    scheduler: IScheduler
  ) {
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
    this.loop.start();
  }

  public stop(): void {
    this.loop.stop();
    this.systemManager.disposeAll();
  }

  private update(dt: number): void {
    this.systemManager.updateAll(dt);
  }

  private render(alpha: number): void {
    this.systemManager.renderAll(alpha);
  }
}
