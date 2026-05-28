import { ARENA_CONFIG } from "./ArenaConfig";

export class SpatialPartitionService {
  public static readonly WALL_LIMIT_X = ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;
  public static readonly FLOOR_Y = ARENA_CONFIG.VERTICAL.FLOOR_Y;
  public static readonly CEILING_Y = ARENA_CONFIG.VERTICAL.CEILING_Y;

  public static clampX(x: number, radius: number): number {
    const limit = ARENA_CONFIG.HORIZONTAL.PLAY_AREA_HALF_WIDTH - radius;
    return Math.max(-limit, Math.min(limit, x));
  }

  public static isOutOfBoundsY(y: number, halfHeight: number): boolean {
    const minY = this.FLOOR_Y + halfHeight;
    const maxY = this.CEILING_Y - halfHeight;
    return y < minY || y > maxY;
  }
}
