import { GameLoop } from "../loop/GameLoop";
import { EventBroker } from "../events/EventBroker";

export class Engine {
  private loop: GameLoop;
  private broker: EventBroker;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.broker = new EventBroker();
    this.loop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render()
    );
  }

  public start(): void {
    this.loop.start();
  }

  public stop(): void {
    this.loop.stop();
  }

  private update(dt: number): void {
    // Scheduled fixed update step
  }

  private render(): void {
    // Scheduled Babylon render pass
  }
}
