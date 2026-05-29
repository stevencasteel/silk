export interface IRaycastHitResult {
  hasHit: boolean;
  hitDistance: number;
  hitPointX: number;
  hitPointY: number;
  hitNormalX: number;
  hitNormalY: number;
}

export interface ISpatialQueryService {
  castHorizontalRay(
    startX: number,
    startY: number,
    directionX: number,
    length: number
  ): IRaycastHitResult;
  
  castVerticalRay(
    startX: number,
    startY: number,
    directionY: number,
    length: number
  ): IRaycastHitResult;

  checkAabbWallCling(
    targetX: number,
    targetY: number,
    halfWidth: number
  ): { isWallClinging: boolean; wallNormalX: number };
}
