export class EngineTime {
  public static timeScale = 1.0;
  public static hitLagTimer = 0.0;
  public static hitLagScale = 1.0;

  public static get activeTimeScale(): number {
    if (this.hitLagTimer > 0) {
      return this.timeScale * this.hitLagScale;
    }
    return this.timeScale;
  }

  public static update(dt: number): void {
    if (this.hitLagTimer > 0) {
      this.hitLagTimer = Math.max(0, this.hitLagTimer - dt);
    }
  }
}
