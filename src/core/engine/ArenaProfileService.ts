import { ARENA_CONFIG } from "./ArenaConfig";

export interface ArenaProfile {
  scrollSpeed: number;
  projectileSpeed: number;
  reloadTime: number;
  weaverSpeed: number;
}

export class ArenaProfileService {
  private static currentAltitude = 0.0;

  public static setAltitude(altitude: number): void {
    this.currentAltitude = Math.max(0, altitude);
  }

  public static getAltitude(): number {
    return this.currentAltitude;
  }

  public static getActiveProfile(): ArenaProfile {
    const factor = Math.min(1.0, this.currentAltitude / 1000.0);

    return {
      scrollSpeed: ARENA_CONFIG.SCROLL_SPEED.BASE + factor * 4.5,
      projectileSpeed: 15.0 + factor * 8.0,
      reloadTime: Math.max(1.2, 2.4 - factor * 0.8),
      weaverSpeed: 4.5 + factor * 3.5
    };
  }
}
