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
    const color = new BABYLON.Color3(colors.PLAYER_SPARK.r, colors.PLAYER_SPARK.g, colors.PLAYER_SPARK.b);
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
    const color = new BABYLON.Color3(colors.WEAVER_SPARK.r, colors.WEAVER_SPARK.g, colors.WEAVER_SPARK.b);
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
    const color = new BABYLON.Color3(colors.LANDING_DUST.r, colors.LANDING_DUST.g, colors.LANDING_DUST.b);
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
    const color = new BABYLON.Color3(colors.PROJECTILE_SPLAT.r, colors.PROJECTILE_SPLAT.g, colors.PROJECTILE_SPLAT.b);
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
