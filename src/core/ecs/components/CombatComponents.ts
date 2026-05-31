export interface HealthComponent {
  current: number;
  max: number;
}

export interface HitboxComponent {
  ownerId: number;
  isActive: boolean;
  radius: number;
  damage: number;
  targetLayer: "PLAYER" | "WEAVER" | "BOTH";
  knockbackX?: number;
  knockbackY?: number;
  lastHitTime?: number;
  hitCooldown?: number;
}

export interface HurtboxComponent {
  ownerId: number;
  isActive: boolean;
  radius: number;
  layer: "PLAYER" | "WEAVER";
}

export interface InvulnerabilityComponent {
  timeRemaining: number;
}

export interface HitStopComponent {
  timeRemaining: number;
}
