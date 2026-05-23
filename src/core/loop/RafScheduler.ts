import { IScheduler, SchedulerCallback } from "./IScheduler";

export class RafScheduler implements IScheduler {
  private rafId: number | null = null;
  private callback: SchedulerCallback | null = null;

  public start(callback: SchedulerCallback): void {
    this.callback = callback;
    const loop = (time: number) => {
      if (this.callback) {
        this.callback(time);
        this.rafId = requestAnimationFrame(loop);
      }
    };
    this.rafId = requestAnimationFrame(loop);
  }

  public stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.callback = null;
  }
}
