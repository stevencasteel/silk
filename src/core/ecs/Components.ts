export interface TransformComponent {
    x: number; y: number; z: number;
    qx: number; qy: number; qz: number; qw: number;
    prevX: number; prevY: number; prevZ: number;
    prevQx: number; prevQy: number; prevQz: number; prevQw: number;
}

export interface KinematicVelocityComponent { x: number; y: number; z: number; }
export interface KinematicTargetComponent { x: number; y: number; z: number; active: boolean; }

export interface SilkComponent {
    anchorX: number; anchorY: number; anchorZ: number;
    maxLength: number;
    currentLength: number;
    isAttached: boolean;
    tension: number;
    dynamicVelX: number;
    dynamicVelY: number;
}

export interface HealthComponent { current: number; max: number; }

export interface InputIntentComponent {
    x: number; y: number;
    jump: boolean;
    fire: boolean;
    detach: boolean;
}

export interface WeaverAIComponent {
    state: string;
    timeInState: number;
    targetX: number;
    targetY: number;
    hue: string;
    hasFakedDeath: boolean;
}

export interface PlayerStatsComponent {
    moveSpeed: number;
    climbSpeed: number;
    swingForce: number;
    minRope: number;
    maxRope: number;
}

export interface PlayerTag { readonly tag?: "player"; }
export interface WeaverTag { readonly tag?: "weaver"; }
export interface AnchorTag { readonly tag?: "anchor"; }
export interface InvulnerabilityComponent { timeRemaining: number; }

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
    velX: number;
    velY: number;
    isGrounded: boolean;
    isWallClinging: boolean;
    wallNormalX: number;
}
