import * as BABYLON from "@babylonjs/core";
import { VISUAL_JUICE_CONFIG } from "../../core/engine/ArenaConfig";

export interface IParticleEmitContext {
  emitRawParticle(
    position: BABYLON.Vector3,
    velocity: BABYLON.Vector3,
    life: number,
    color: BABYLON.Color3
  ): void;
}

export interface IParticleEmitterStrategy {
  emit(context: IParticleEmitContext, position: BABYLON.Vector3): void;
}

export class PlayerSparkStrategy implements IParticleEmitterStrategy {
  constructor(private count?: number) {}

  public emit(context: IParticleEmitContext, position: BABYLON.Vector3): void {
    const config = VISUAL_JUICE_CONFIG.PARTICLES.BURST.PLAYER;
    const colors = VISUAL_JUICE_CONFIG.PARTICLES.COLORS;
    const color = new BABYLON.Color3(
      colors.PLAYER_SPARK.r,
      colors.PLAYER_SPARK.g,
      colors.PLAYER_SPARK.b
    );
    const count = this.count ?? config.COUNT;

    const tempVel = new BABYLON.Vector3();
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * 2.0 * Math.PI;
      const speedSpan = config.VELOCITY_SPEED_MAX - config.VELOCITY_SPEED_MIN;
      const r = config.VELOCITY_SPEED_MIN + Math.random() * speedSpan;
      const ySpan = config.VELOCITY_Y_MAX - config.VELOCITY_Y_MIN;
      const vy = config.VELOCITY_Y_MIN + Math.random() * ySpan;
      const vz = (Math.random() - 0.5) * config.VELOCITY_Z_MAX;

      tempVel.set(Math.cos(theta) * r, vy, vz);
      const life = config.LIFE_MIN + Math.random() * (config.LIFE_MAX - config.LIFE_MIN);

      context.emitRawParticle(position, tempVel, life, color);
    }
  }
}

export class WeaverSparkStrategy implements IParticleEmitterStrategy {
  constructor(private count?: number) {}

  public emit(context: IParticleEmitContext, position: BABYLON.Vector3): void {
    const config = VISUAL_JUICE_CONFIG.PARTICLES.BURST.WEAVER;
    const colors = VISUAL_JUICE_CONFIG.PARTICLES.COLORS;
    const color = new BABYLON.Color3(
      colors.WEAVER_SPARK.r,
      colors.WEAVER_SPARK.g,
      colors.WEAVER_SPARK.b
    );
    const count = this.count ?? config.COUNT;

    const tempVel = new BABYLON.Vector3();
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * 2.0 * Math.PI;
      const speedSpan = config.VELOCITY_SPEED_MAX - config.VELOCITY_SPEED_MIN;
      const r = config.VELOCITY_SPEED_MIN + Math.random() * speedSpan;
      const ySpan = config.VELOCITY_Y_MAX - config.VELOCITY_Y_MIN;
      const vy = config.VELOCITY_Y_MIN + Math.random() * ySpan;
      const vz = (Math.random() - 0.5) * config.VELOCITY_Z_MAX;

      tempVel.set(Math.cos(theta) * r, vy, vz);
      const life = config.LIFE_MIN + Math.random() * (config.LIFE_MAX - config.LIFE_MIN);

      context.emitRawParticle(position, tempVel, life, color);
    }
  }
}

export class LandingDustStrategy implements IParticleEmitterStrategy {
  public emit(context: IParticleEmitContext, position: BABYLON.Vector3): void {
    const config = VISUAL_JUICE_CONFIG.PARTICLES.BURST.LANDING;
    const colors = VISUAL_JUICE_CONFIG.PARTICLES.COLORS;
    const color = new BABYLON.Color3(
      colors.LANDING_DUST.r,
      colors.LANDING_DUST.g,
      colors.LANDING_DUST.b
    );
    const count = config.COUNT;

    const tempVel = new BABYLON.Vector3();
    for (let i = 0; i < count; i++) {
      const vx = (Math.random() - 0.5) * config.VELOCITY_X_MAX;
      const vy = Math.random() * config.VELOCITY_Y_MAX;
      const vz = (Math.random() - 0.5) * config.VELOCITY_Z_MAX;

      tempVel.set(vx, vy, vz);
      const life = config.LIFE_MIN + Math.random() * (config.LIFE_MAX - config.LIFE_MIN);

      context.emitRawParticle(position, tempVel, life, color);
    }
  }
}

export class WallSparksStrategy implements IParticleEmitterStrategy {
  constructor(private wallNormalX: number) {}

  public emit(context: IParticleEmitContext, position: BABYLON.Vector3): void {
    const config = VISUAL_JUICE_CONFIG.PARTICLES.BURST.WALL;
    const colors = VISUAL_JUICE_CONFIG.PARTICLES.COLORS;
    const color = new BABYLON.Color3(colors.WALL_SPARK.r, colors.WALL_SPARK.g, colors.WALL_SPARK.b);
    const count = config.COUNT;

    const tempVel = new BABYLON.Vector3();
    for (let i = 0; i < count; i++) {
      const xSpan = config.VELOCITY_X_MAX - config.VELOCITY_X_MIN;
      const vx = this.wallNormalX * (config.VELOCITY_X_MIN + Math.random() * xSpan);
      const vy = (Math.random() - 0.3) * config.VELOCITY_Y_MAX;
      const vz = (Math.random() - 0.5) * config.VELOCITY_Z_MAX;

      tempVel.set(vx, vy, vz);
      const life = config.LIFE_MIN + Math.random() * (config.LIFE_MAX - config.LIFE_MIN);

      context.emitRawParticle(position, tempVel, life, color);
    }
  }
}

export class WebSplatStrategy implements IParticleEmitterStrategy {
  public emit(context: IParticleEmitContext, position: BABYLON.Vector3): void {
    const config = VISUAL_JUICE_CONFIG.PARTICLES.BURST.PROJECTILE;
    const colors = VISUAL_JUICE_CONFIG.PARTICLES.COLORS;
    const color = new BABYLON.Color3(
      colors.PROJECTILE_SPLAT.r,
      colors.PROJECTILE_SPLAT.g,
      colors.PROJECTILE_SPLAT.b
    );
    const count = config.COUNT;

    const tempVel = new BABYLON.Vector3();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2.0;
      const speed = config.SPEED_MIN + Math.random() * (config.SPEED_MAX - config.SPEED_MIN);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const vz = (Math.random() - 0.5) * config.VELOCITY_Z_MAX;

      tempVel.set(vx, vy, vz);
      const life = config.LIFE_MIN + Math.random() * (config.LIFE_MAX - config.LIFE_MIN);

      context.emitRawParticle(position, tempVel, life, color);
    }
  }
}

export class LaunchTrailStrategy implements IParticleEmitterStrategy {
  public emit(context: IParticleEmitContext, position: BABYLON.Vector3): void {
    const colors = VISUAL_JUICE_CONFIG.PARTICLES.COLORS;
    const trail = VISUAL_JUICE_CONFIG.PARTICLES.BURST.TRAIL;

    const tempPos = position.clone();
    tempPos.x += (Math.random() - 0.5) * trail.OFFSET_X;
    tempPos.y += (Math.random() - 0.5) * trail.OFFSET_Y;

    const vx = (Math.random() - 0.5) * trail.VELOCITY_X_MAX;
    const vy = (Math.random() - 0.5) * trail.VELOCITY_Y_MAX;
    const vz = (Math.random() - 0.5) * trail.VELOCITY_Z_MAX;

    const tempVel = new BABYLON.Vector3(vx, vy, vz);
    const life = trail.LIFE_MIN + Math.random() * (trail.LIFE_MAX - trail.LIFE_MIN);

    const color = new BABYLON.Color3(
      colors.PLAYER_SPARK.r,
      colors.PLAYER_SPARK.g,
      colors.PLAYER_SPARK.b
    );
    context.emitRawParticle(tempPos, tempVel, life, color);
  }
}

export class WallSlideSparksStrategy implements IParticleEmitterStrategy {
  constructor(
    private wallNormalX: number,
    private tension: number,
    private dt: number
  ) {}

  public emit(context: IParticleEmitContext, position: BABYLON.Vector3): void {
    const colors = VISUAL_JUICE_CONFIG.PARTICLES.COLORS;
    const baseChance = 0.15;
    const tensionBonus = this.tension * 0.85;
    const totalChance = Math.min(1.0, baseChance + tensionBonus);

    const ticks = Math.max(1, Math.round(this.dt * 60.0));
    for (let t = 0; t < ticks; t++) {
      if (Math.random() < totalChance) {
        const speedMult = 1.0 + this.tension * 1.5;
        const vx = this.wallNormalX * (3.0 + Math.random() * 5.0) * speedMult;
        const vy = (Math.random() - 0.2) * 4.0 * speedMult;
        const vz = (Math.random() - 0.5) * 1.5;

        const tempVel = new BABYLON.Vector3(vx, vy, vz);
        const life = 0.15 + Math.random() * 0.25;

        let color: BABYLON.Color3;
        if (this.tension > 0.8) {
          color = new BABYLON.Color3(1.0, 0.95, 0.8);
        } else if (this.tension > 0.4) {
          color = new BABYLON.Color3(1.0, 0.65, 0.15);
        } else {
          color = new BABYLON.Color3(colors.WALL_SPARK.r, colors.WALL_SPARK.g, colors.WALL_SPARK.b);
        }

        context.emitRawParticle(position, tempVel, life, color);
      }
    }
  }
}
