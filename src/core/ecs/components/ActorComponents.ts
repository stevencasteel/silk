export type ActorTagType = "player" | "weaver" | "healthBug";

export interface TagComponent {
  type: ActorTagType;
}

export interface InputIntentComponent {
  x: number;
  y: number;
}

export interface WeaverAIComponent {
  state: string;
  timeInState: number;
  hue: string;
  damageShearIntensity: number;
  damageShearTime: number;
  desiredVelocityX: number;
  desiredVelocityY: number;
  shootRequested: boolean;
  shootOriginX?: number;
  shootOriginY?: number;
  shootTargetX?: number;
  shootTargetY?: number;
  shootIsRelease?: boolean;
  shakeRequested: boolean;
  shakeAmplitude?: number;
  shakeDuration?: number;
  isThrusting?: boolean;
}

export type TraversalState = "AIRBORNE" | "WALL_STICKING" | "LAUNCHING";

export interface TraversalStateComponent {
  state: TraversalState;
  wallNormalX: number;
  wallNormalY: number;
  wallDir: number;
  launchTimer: number;
  launchPower: number;
  stickyEntityId?: number;
  stickyWallX?: number;
  stickyWallYOffset?: number;
  isWebTrapped?: boolean;
  escapeProgress?: number;
  escapeRequired?: number;
  recoilTimer?: number;
  lastEscapeDirection?: "UP" | "DOWN" | "LEFT" | "RIGHT" | "";
  hasFlingBonus?: boolean;
  safeLaunchTimer?: number;
  lastStickyEntityId?: number;
  webMass?: number;
  recoilVelocityY?: number;
}

export interface WeaverTraversalComponent {
  isGrounded: boolean;
  isWallClinging: boolean;
  wallNormalX: number;
}

export interface WallBugComponent {
  state: "CRAWLING_DOWN" | "INACTIVE";
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  gaitPhase: number;
  spikedSide?: "LEFT" | "RIGHT" | "NONE";
  spikesDisarmed?: boolean;
}

export interface StickySurfaceComponent {
  isActive: boolean;
  width: number;
  height: number;
  speed: number;
}

export interface ProjectileComponent {
  isActive: boolean;
  isStuck: boolean;
  isStuckOnWall: boolean;
  lifeTime: number;
  fallbackX: number;
  fallbackY: number;
  isTrappingPlayer?: boolean;
  isCharging?: boolean;
  stickyEntityId?: number;
  stickyOffsetX?: number;
  stickyOffsetY?: number;
  isStuckToBug?: boolean;
  isRed?: boolean;
}

export type SweepPhase = "SWEEP" | "HOLD" | "LAUNCH";

export interface WeaverSweepComponent {
  phase: SweepPhase;
  timer: number;
  direction: number;
}

export type HealthBugState =
  | "FLYING_UP"
  | "PAUSED"
  | "CONTINUING"
  | "SHOVED"
  | "PINBALL"
  | "SPINNING"
  | "RECOVERING"
  | "DEAD";
export type HealthBugVariant =
  | "NORMAL"
  | "SPIKED_TOP"
  | "SPIKED_RIGHT"
  | "SPIKED_BOTTOM"
  | "SPIKED_LEFT";

export interface HealthBugComponent {
  state: HealthBugState;
  variant: HealthBugVariant;
  timer: number;
  pauseDuration: number;
  x: number;
  y: number;
  preInfluenceX: number;
  preInfluenceY: number;
  preInfluenceState: HealthBugState;
  isWebTrapped: boolean;
  stuckToProjectileId?: number;
  isStuckOnWall: boolean;
  isStuckToBug: boolean;
  stickyEntityId?: number;
  stickyOffsetX?: number;
  stickyOffsetY?: number;
  spikesDisarmed: boolean;
  rotorAngle: number;
  pauseThresholdY: number;
}
