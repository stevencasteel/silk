export interface TransformComponent {
    x: number; y: number; z: number;
    qx: number; qy: number; qz: number; qw: number;
    prevX: number; prevY: number; prevZ: number;
    prevQx: number; prevQy: number; prevQz: number; prevQw: number;
}
export interface KinematicVelocityComponent { x: number; y: number; z: number; }
export interface KinematicTargetComponent { x: number; y: number; z: number; active: boolean; }
export interface TetherComponent {
    anchorX: number; anchorY: number; anchorZ: number;
    maxLength: number; currentLength: number;
    isAttached: boolean; tension: number;
    dynamicVelX: number; dynamicVelY: number;
}
export interface HealthComponent { current: number; max: number; }
export interface InputIntentComponent { x: number; y: number; jump: boolean; fire: boolean; }
export interface WardenAIComponent { state: string; timeInState: number; targetX: number; targetY: number; hue: string; }
export interface PlayerStatsComponent { moveSpeed: number; climbSpeed: number; swingForce: number; minRope: number; maxRope: number; }
export interface PlayerTag {}
export interface WardenTag {}
export interface AnchorTag {}
