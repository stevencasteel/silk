export class EngineTime {
  public static timeScale = 1.0;
  public static hitStopTimer = 0.0;

  public static get isHitStop(): boolean {
    return this.hitStopTimer > 0;
  }

  public static update(dt: number): void {
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
    }
  }
}
