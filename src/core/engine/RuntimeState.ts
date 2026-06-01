import { ARENA_CONFIG } from "./ArenaConfig";

export interface ArenaProfile {
  scrollSpeed: number;
  projectileSpeed: number;
  reloadTime: number;
  weaverSpeed: number;
}

export class RuntimeState {
  public currentScrollSpeed: number = ARENA_CONFIG.SCROLL_SPEED.BASE;
  public timeScale: number = 1.0;
  public hitLagTimer: number = 0.0;
  public hitLagScale: number = 1.0;
  public altitude: number = 0.0;
  public gameStarted: boolean = false;
  public wallBugsSpawningAllowed: boolean = false;
  public healthBugsSpawningAllowed: boolean = false;
  public tetherDamagePauseTimer: number = 0.0;

  public get activeTimeScale(): number {
    if (this.hitLagTimer > 0) {
      return this.timeScale * this.hitLagScale;
    }
    return this.timeScale;
  }

  public get activeProfile(): ArenaProfile {
    const factor = Math.min(1.0, this.altitude / 1000.0);
    return {
      scrollSpeed: ARENA_CONFIG.SCROLL_SPEED.BASE + factor * 4.5,
      projectileSpeed: 15.0 + factor * 8.0,
      reloadTime: Math.max(1.2, 2.4 - factor * 0.8),
      weaverSpeed: 4.5 + factor * 3.5
    };
  }

  public reset(): void {
    this.currentScrollSpeed = ARENA_CONFIG.SCROLL_SPEED.BASE;
    this.timeScale = 1.0;
    this.hitLagTimer = 0.0;
    this.hitLagScale = 1.0;
    this.altitude = 0.0;
    this.gameStarted = false;
    this.wallBugsSpawningAllowed = false;
    this.healthBugsSpawningAllowed = false;
    this.tetherDamagePauseTimer = 0.0;
  }
}
