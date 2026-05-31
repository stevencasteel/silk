export interface CollisionStateComponent {
  isGrounded: boolean;
  isWallClinging: boolean;
  wallNormalX: number;
  wallNormalY: number;
  lastHitType: "NONE" | "WALL" | "GROUND" | "PROJECTILE";
  hitPointX: number;
  hitPointY: number;
}

export interface CollisionResponseComponent {
  layer: "PLAYER" | "WEAVER" | "PROJECTILE" | "HAZARD";
  onHit?: (
    damage: number,
    source: string,
    directionX: number,
    directionY: number,
    context: unknown
  ) => void;
  onOverlap?: (otherId: number, context: unknown) => void;
}

export interface BoundaryConstraintComponent {
  isActive: boolean;
  limitX: number;
  layer: "PLAYER" | "PROJECTILE";
  onBoundaryHit?: (id: number, side: "LEFT" | "RIGHT", currentX: number) => void;
}

export interface TetherComponent {
  anchorX: number;
  anchorY: number;
  anchorZ: number;
  maxLength: number;
  currentLength: number;
  isAttached: boolean;
  tension: number;
  desiredLength: number;
  reelVelocity: number;
}

export interface TetherStrainComponent {
  strain: number;
  strainTimer: number;
  isOverloaded: boolean;
  damageCount?: number;
  lastDamageTime?: number;
}
