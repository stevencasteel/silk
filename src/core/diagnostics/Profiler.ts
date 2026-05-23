export class Profiler {
  private fps: number = 0;
  private frameCount: number = 0;
  private lastTime: number = performance.now();

  public update(): void {
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastTime = now;
    }
  }

  public getFps(): number {
    return this.fps;
  }
}
