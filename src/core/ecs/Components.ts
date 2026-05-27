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
}

export interface HealthComponent {
  current: number;
  max: number;
}

export interface InputIntentComponent {
  x: number;
  y: number;
  jump: boolean;
}

export interface WeaverAIComponent {
  state: string;
  timeInState: number;
  hue: string;
  scrollSpeed: number;
  damageShearIntensity: number;
  damageShearTime: number;
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
}

export interface WeaverTraversalComponent {
  isGrounded: boolean;
  isWallClinging: boolean;
  wallNormalX: number;
}
