export interface TransformComponent {
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  prevX: number;
  prevY: number;
  prevZ: number;
  prevQx: number;
  prevQy: number;
  prevQz: number;
  prevQw: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  prevScaleX?: number;
  prevScaleY?: number;
  prevScaleZ?: number;
  scaleVelX?: number;
  scaleVelY?: number;
  scaleVelZ?: number;
}

export interface KinematicVelocityComponent {
  x: number;
  y: number;
  z: number;
}

export interface KinematicTargetComponent {
  x: number;
  y: number;
  z: number;
  active: boolean;
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
  reelHeat: number;
}

export interface HealthComponent {
  current: number;
  max: number;
}

export interface InputIntentComponent {
  x: number;
  y: number;
}

export interface WeaverAIComponent {
  state: string;
  timeInState: number;
  hue: string;
  scrollSpeed: number;
  damageShearIntensity: number;
  damageShearTime: number;
  desiredVelocityX: number;
  desiredVelocityY: number;
  shootRequested: boolean;
  shootOriginX?: number;
  shootOriginY?: number;
  shootTargetX?: number;
  shootTargetY?: number;
  shakeRequested: boolean;
  shakeAmplitude?: number;
  shakeDuration?: number;
}

export interface PlayerTag {
  readonly tag?: "player";
}

export interface WeaverTag {
  readonly tag?: "weaver";
}

export interface InvulnerabilityComponent {
  timeRemaining: number;
}

export type TraversalState = "AIRBORNE" | "WALL_SLIDING" | "LAUNCHING" | "GROUNDED";

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
}

export interface WeaverTraversalComponent {
  isGrounded: boolean;
  isWallClinging: boolean;
  wallNormalX: number;
}

export interface WallBugComponent {
  state: "CRAWLING_DOWN" | "INACTIVE";
  timer: number;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  stayDuration: number;
  gaitPhase: number;
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
}

export type SweepPhase = "SWEEP" | "HOLD" | "LAUNCH";

export interface WeaverSweepComponent {
  phase: SweepPhase;
  timer: number;
  direction: number;
}

export interface CollisionStateComponent {
  isGrounded: boolean;
  isWallClinging: boolean;
  wallNormalX: number;
  wallNormalY: number;
  lastHitType: "NONE" | "WALL" | "GROUND" | "PROJECTILE";
  hitPointX: number;
  hitPointY: number;
}

export interface TetherStrainComponent {
  strain: number;
  strainTimer: number;
  isOverloaded: boolean;
}

export interface ParticleEmitterComponent {
  emitterType: "SLIDING_SPARKS" | "TRAIL" | "NONE";
  isActive: boolean;
  rate: number;
  colorR: number;
  colorG: number;
  colorB: number;
}

export interface HitboxComponent {
  ownerId: number;
  isActive: boolean;
  radius: number;
  damage: number;
  targetLayer: "PLAYER" | "WEAVER" | "BOTH";
  knockbackX?: number;
  knockbackY?: number;
}

export interface HurtboxComponent {
  ownerId: number;
  isActive: boolean;
  radius: number;
  layer: "PLAYER" | "WEAVER";
}

export interface ParticleRequestComponent {
  type: "PLAYER_SPARK" | "WEAVER_SPARK" | "LANDING_DUST" | "WALL_SPARK" | "PROJECTILE_SPLAT";
  x: number;
  y: number;
  z: number;
  count?: number;
  wallNormalX?: number;
}

export interface PlayerCosmeticComponent {
  emissiveR: number;
  emissiveG: number;
  emissiveB: number;
  targetScaleX: number;
  targetScaleY: number;
  targetScaleZ: number;
  springStiffness: number;
  springDamping: number;
  rotationAngle: number;
  slerpFactor: number;
}

export interface WeaverCosmeticComponent {
  emissiveHue: string;
  targetScaleX: number;
  targetScaleY: number;
  targetScaleZ: number;
  springStiffness: number;
  springDamping: number;
  wobbleAngle: number;
  rotationAngle: number;
  rotationSpeed: number;
  gaitAmplitude: number;
  gaitFrequency: number;
  gaitTuck: number;
}
