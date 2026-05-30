export class EngineTime {
  public static timeScale = 1.0;
  public static hitStopTimer = 0.0;
  public static hitLagTimer = 0.0;
  public static hitLagScale = 1.0;

  public static get isHitStop(): boolean {
    return this.hitStopTimer > 0;
  }

  public static get activeTimeScale(): number {
    if (this.hitLagTimer > 0) {
      return this.timeScale * this.hitLagScale;
    }
    return this.timeScale;
  }

  public static update(dt: number): void {
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
    }
    if (this.hitLagTimer > 0) {
      this.hitLagTimer = Math.max(0, this.hitLagTimer - dt);
    }
  }
}
