import { IClock } from "../clock/IClock";
import { IScheduler } from "./IScheduler";

export class GameLoop {
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly fixedStep: number = 1 / 60;

  private onUpdate: (dt: number) => void;
  private onRender: (interpolationAlpha: number) => void;
  private clock: IClock;
  private scheduler: IScheduler;

  constructor(
    onUpdate: (dt: number) => void,
    onRender: (interpolationAlpha: number) => void,
    clock: IClock,
    scheduler: IScheduler
  ) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
    this.clock = clock;
    this.scheduler = scheduler;

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = this.clock.now();
    this.accumulator = 0;
    this.scheduler.start((t) => this.tick(t));
  }

  public stop(): void {
    this.isRunning = false;
    this.scheduler.stop();
  }

  private tick(now: number): void {
    if (!this.isRunning) return;

    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (dt > 0.1) {
      dt = 0.1;
    }

    this.accumulator += dt;

    while (this.accumulator >= this.fixedStep) {
      this.onUpdate(this.fixedStep);
      this.accumulator -= this.fixedStep;
    }

    const alpha = this.accumulator / this.fixedStep;
    this.onRender(alpha);
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.stop();
    } else {
      this.start();
    }
  };

  public cleanup(): void {
    this.stop();
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }
  }
}
