export class GameLoop {
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly fixedStep: number = 1 / 60;
  private onUpdate: (dt: number) => void;
  private onRender: (interpolationAlpha: number) => void;
  private rafId: number | null = null;

  constructor(onUpdate: (dt: number) => void, onRender: (interpolationAlpha: number) => void) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
    if (typeof window !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }

  public stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
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

    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.stop;
    } else {
      this.start();
    }
  };

  public cleanup(): void {
    this.stop();
    if (typeof window !== "undefined") {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }
  }
}
