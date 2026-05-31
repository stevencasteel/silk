import { IProfiler } from "./IProfiler";

export class Profiler implements IProfiler {
  public isEnabled = false;
  private systemTimings = new Map<string, number>();
  private frameStart = 0;
  private frameTime = 0;
  private fps = 0;
  private frameCount = 0;
  private lastFpsUpdate = performance.now();

  public beginFrame(): void {
    if (!this.isEnabled) return;
    this.frameStart = performance.now();
  }

  public endFrame(): void {
    if (!this.isEnabled) return;
    this.frameTime = performance.now() - this.frameStart;
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsUpdate >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }

  public recordSystem(name: string, duration: number): void {
    if (!this.isEnabled) return;
    this.systemTimings.set(name, duration);
  }

  public getFps(): number {
    return this.fps;
  }
  public getFrameTime(): number {
    return this.frameTime;
  }
  public getSystemTimings(): Map<string, number> {
    return this.systemTimings;
  }

  public clearFrame(): void {
    if (!this.isEnabled) return;
    this.systemTimings.clear();
  }
}
