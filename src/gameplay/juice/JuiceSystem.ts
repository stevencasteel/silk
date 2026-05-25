import { VISUAL_JUICE_CONFIG } from "../../core/engine/ArenaConfig";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { GameEvent } from "../../core/events/GameEvents";
import * as BABYLON from "@babylonjs/core";

interface PooledParticle {
  mesh: BABYLON.Mesh;
  velocity: BABYLON.Vector3;
  lifeRemaining: number;
  maxLife: number;
  active: boolean;
}

export class JuiceSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;

  private particlePool: PooledParticle[] = [];
  private poolSize = 64;
  private nextPoolIndex = 0;
  private parentNode: BABYLON.TransformNode | null = null;
  private unsubscribes: (() => void)[] = [];
  private playerState: string = "AIRBORNE";

  constructor(private context: SystemContext) {}

  public init(): void {
    const scene = this.context.visualRegistry.getScene();
    if (!scene) return;

    this.parentNode = new BABYLON.TransformNode("juiceParticleRoot", scene);

    for (let i = 0; i < this.poolSize; i++) {
      const box = BABYLON.MeshBuilder.CreateBox("juiceParticle_" + i, { size: 0.15 }, scene);
      const mat = new BABYLON.StandardMaterial("juiceParticleMat_" + i, scene);
      mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
      mat.disableLighting = true;
      box.material = mat;
      box.parent = this.parentNode;
      box.setEnabled(false);

      this.particlePool.push({
        mesh: box,
        velocity: new BABYLON.Vector3(),
        lifeRemaining: 0,
        maxLife: 1.0,
        active: false
      });
    }

    const config = VISUAL_JUICE_CONFIG.PARTICLES;

    this.unsubscribes.push(
      this.context.broker.subscribe(GameEvent.PLAYER_DAMAGED, () => {
        const playerNode = this.context.visualRegistry.getTransformNode(this.context.refs.player);
        if (playerNode) {
          this.spawnBurst(
            playerNode.position,
            new BABYLON.Color3(0.13, 0.77, 0.36),
            config.BURST.PLAYER.COUNT,
            config.BURST.PLAYER
          );
        }
      })
    );

    this.unsubscribes.push(
      this.context.broker.subscribe(GameEvent.WEAVER_DAMAGED, () => {
        const weaverNode = this.context.visualRegistry.getTransformNode(this.context.refs.weaver);
        if (weaverNode) {
          this.spawnBurst(
            weaverNode.position,
            new BABYLON.Color3(0.93, 0.22, 0.22),
            config.BURST.WEAVER.COUNT,
            config.BURST.WEAVER
          );
        }
      })
    );

    this.unsubscribes.push(
      this.context.broker.subscribe(GameEvent.PLAYER_LANDED, (payload: { x: number; y: number }) => {
        const pos = new BABYLON.Vector3(payload.x, payload.y, 0);
        this.spawnLandingDust(pos);
      })
    );

    this.unsubscribes.push(
      this.context.broker.subscribe(GameEvent.PLAYER_WALL_HIT, (payload: { x: number; y: number; wallNormalX: number }) => {
        const pos = new BABYLON.Vector3(payload.x, payload.y, 0);
        this.spawnWallSparks(pos, payload.wallNormalX);
      })
    );

    this.unsubscribes.push(
      this.context.broker.subscribe(GameEvent.PROJECTILE_IMPACT, (payload: { x: number; y: number; isWall: boolean }) => {
        const pos = new BABYLON.Vector3(payload.x, payload.y, 0);
        this.spawnWebSplat(pos);
      })
    );

    this.unsubscribes.push(
      this.context.broker.subscribe(GameEvent.PLAYER_STATE_CHANGE, (payload: { state: string }) => {
        this.playerState = payload.state;
      })
    );

    this.unsubscribes.push(
      this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.playerState = "AIRBORNE";
      })
    );
  }

  private spawnBurst(
    position: BABYLON.Vector3,
    color: BABYLON.Color3,
    count: number,
    settings: {
      readonly VELOCITY_Y_MIN: number;
      readonly VELOCITY_Y_MAX: number;
      readonly VELOCITY_Z_MAX: number;
      readonly VELOCITY_SPEED_MIN: number;
      readonly VELOCITY_SPEED_MAX: number;
      readonly LIFE_MIN: number;
      readonly LIFE_MAX: number;
    }
  ): void {
    for (let i = 0; i < count; i++) {
      const particle = this.particlePool[this.nextPoolIndex];
      particle.mesh.position.copyFrom(position);

      const theta = Math.random() * 2.0 * Math.PI;
      const speedSpan = settings.VELOCITY_SPEED_MAX - settings.VELOCITY_SPEED_MIN;
      const r = settings.VELOCITY_SPEED_MIN + Math.random() * speedSpan;
      
      const ySpan = settings.VELOCITY_Y_MAX - settings.VELOCITY_Y_MIN;
      const vy = settings.VELOCITY_Y_MIN + Math.random() * ySpan;
      const vz = (Math.random() - 0.5) * settings.VELOCITY_Z_MAX;

      particle.velocity.set(Math.cos(theta) * r, vy, vz);
      particle.lifeRemaining = settings.LIFE_MIN + Math.random() * (settings.LIFE_MAX - settings.LIFE_MIN);
      particle.maxLife = particle.lifeRemaining;
      particle.active = true;
      particle.mesh.setEnabled(true);

      const mat = particle.mesh.material as BABYLON.StandardMaterial;
      if (mat) {
        mat.emissiveColor.copyFrom(color);
      }

      this.nextPoolIndex = (this.nextPoolIndex + 1) % this.poolSize;
    }
  }

  private spawnLandingDust(position: BABYLON.Vector3): void {
    const config = VISUAL_JUICE_CONFIG.PARTICLES.BURST.LANDING;
    const count = config.COUNT;
    const color = new BABYLON.Color3(0.65, 0.65, 0.68);
    for (let i = 0; i < count; i++) {
      const particle = this.particlePool[this.nextPoolIndex];
      particle.mesh.position.copyFrom(position);

      const vx = (Math.random() - 0.5) * config.VELOCITY_X_MAX;
      const vy = Math.random() * config.VELOCITY_Y_MAX;
      const vz = (Math.random() - 0.5) * config.VELOCITY_Z_MAX;

      particle.velocity.set(vx, vy, vz);
      particle.lifeRemaining = config.LIFE_MIN + Math.random() * (config.LIFE_MAX - config.LIFE_MIN);
      particle.maxLife = particle.lifeRemaining;
      particle.active = true;
      particle.mesh.setEnabled(true);

      const mat = particle.mesh.material as BABYLON.StandardMaterial;
      if (mat) mat.emissiveColor.copyFrom(color);

      this.nextPoolIndex = (this.nextPoolIndex + 1) % this.poolSize;
    }
  }

  private spawnWallSparks(position: BABYLON.Vector3, wallNormalX: number): void {
    const config = VISUAL_JUICE_CONFIG.PARTICLES.BURST.WALL;
    const count = config.COUNT;
    const color = new BABYLON.Color3(1.0, 0.85, 0.35);
    for (let i = 0; i < count; i++) {
      const particle = this.particlePool[this.nextPoolIndex];
      particle.mesh.position.copyFrom(position);

      const xSpan = config.VELOCITY_X_MAX - config.VELOCITY_X_MIN;
      const vx = wallNormalX * (config.VELOCITY_X_MIN + Math.random() * xSpan);
      const vy = (Math.random() - 0.3) * config.VELOCITY_Y_MAX;
      const vz = (Math.random() - 0.5) * config.VELOCITY_Z_MAX;

      particle.velocity.set(vx, vy, vz);
      particle.lifeRemaining = config.LIFE_MIN + Math.random() * (config.LIFE_MAX - config.LIFE_MIN);
      particle.maxLife = particle.lifeRemaining;
      particle.active = true;
      particle.mesh.setEnabled(true);

      const mat = particle.mesh.material as BABYLON.StandardMaterial;
      if (mat) mat.emissiveColor.copyFrom(color);

      this.nextPoolIndex = (this.nextPoolIndex + 1) % this.poolSize;
    }
  }

  private spawnWebSplat(position: BABYLON.Vector3): void {
    const config = VISUAL_JUICE_CONFIG.PARTICLES.BURST.PROJECTILE;
    const count = config.COUNT;
    const color = new BABYLON.Color3(0.95, 0.95, 0.98);
    for (let i = 0; i < count; i++) {
      const particle = this.particlePool[this.nextPoolIndex];
      particle.mesh.position.copyFrom(position);

      const angle = Math.random() * Math.PI * 2.0;
      const speed = config.SPEED_MIN + Math.random() * (config.SPEED_MAX - config.SPEED_MIN);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const vz = (Math.random() - 0.5) * config.VELOCITY_Z_MAX;

      particle.velocity.set(vx, vy, vz);
      particle.lifeRemaining = config.LIFE_MIN + Math.random() * (config.LIFE_MAX - config.LIFE_MIN);
      particle.maxLife = particle.lifeRemaining;
      particle.active = true;
      particle.mesh.setEnabled(true);

      const mat = particle.mesh.material as BABYLON.StandardMaterial;
      if (mat) mat.emissiveColor.copyFrom(color);

      this.nextPoolIndex = (this.nextPoolIndex + 1) % this.poolSize;
    }
  }

  private spawnLaunchTrail(position: BABYLON.Vector3): void {
    const particle = this.particlePool[this.nextPoolIndex];
    const trail = VISUAL_JUICE_CONFIG.PARTICLES.BURST.TRAIL;

    particle.mesh.position.copyFrom(position);
    particle.mesh.position.x += (Math.random() - 0.5) * trail.OFFSET_X;
    particle.mesh.position.y += (Math.random() - 0.5) * trail.OFFSET_Y;

    const vx = (Math.random() - 0.5) * trail.VELOCITY_X_MAX;
    const vy = (Math.random() - 0.5) * trail.VELOCITY_Y_MAX;
    const vz = (Math.random() - 0.5) * trail.VELOCITY_Z_MAX;

    particle.velocity.set(vx, vy, vz);
    particle.lifeRemaining = trail.LIFE_MIN + Math.random() * (trail.LIFE_MAX - trail.LIFE_MIN);
    particle.maxLife = particle.lifeRemaining;
    particle.active = true;
    particle.mesh.setEnabled(true);

    const mat = particle.mesh.material as BABYLON.StandardMaterial;
    if (mat) {
      mat.emissiveColor.set(0.13, 0.77, 0.36);
    }

    this.nextPoolIndex = (this.nextPoolIndex + 1) % this.poolSize;
  }

  public update(dt: number): void {
    const gravity = -18.0;
    const particleDrag = Math.pow(0.92, dt * 60.0);
    for (let i = 0; i < this.poolSize; i++) {
      const p = this.particlePool[i];
      if (!p.active) continue;

      p.lifeRemaining -= dt;
      if (p.lifeRemaining <= 0) {
        p.active = false;
        p.mesh.setEnabled(false);
        continue;
      }

      p.velocity.y += gravity * dt;
      p.velocity.x *= particleDrag;
      p.velocity.y *= particleDrag;
      p.velocity.z *= particleDrag;
      p.mesh.position.x += p.velocity.x * dt;
      p.mesh.position.y += p.velocity.y * dt;
      p.mesh.position.z += p.velocity.z * dt;

      const ratio = p.lifeRemaining / p.maxLife;
      p.mesh.scaling.set(ratio, ratio, ratio);
    }

    if (this.playerState === "LAUNCHING") {
      const playerNode = this.context.visualRegistry.getTransformNode(this.context.refs.player) as BABYLON.Mesh | null;
      if (playerNode) {
        this.spawnLaunchTrail(playerNode.position);
      }
    }
  }

  public dispose(): void {
    this.unsubscribes.forEach((unsub) => unsub());
    this.unsubscribes = [];
    if (this.parentNode) {
      this.parentNode.dispose();
    }
    this.particlePool.forEach((p) => {
      p.mesh.dispose();
      if (p.mesh.material) p.mesh.material.dispose();
    });
    this.particlePool = [];
  }
}
