import { CANONICAL_UNITS } from "../../core/engine/ArenaConfig";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import * as BABYLON from "@babylonjs/core";

interface PooledParticle {
  mesh: BABYLON.Mesh;
  velocity: BABYLON.Vector3;
  lifeRemaining: number;
  maxLife: number;
  active: boolean;
}

interface ActiveDebris {
  mesh: BABYLON.Mesh;
  aggregate: BABYLON.PhysicsAggregate | null;
  velocity: BABYLON.Vector3;
  angularVelocity: BABYLON.Vector3;
  lifeRemaining: number;
}

export class JuiceSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;

  private particlePool: PooledParticle[] = [];
  private poolSize = 64;
  private nextPoolIndex = 0;
  private parentNode: BABYLON.TransformNode | null = null;
  private unsubscribes: (() => void)[] = [];

  private activeDebrisList: ActiveDebris[] = [];
  private debrisMat: BABYLON.PBRMaterial | null = null;

  private scratchVector = new BABYLON.Vector3();

  constructor(
    private broker: EventBroker,
    private refs: EntityRefs,
    private visualRegistry: IVisualRegistry
  ) {}

  public init(): void {
    const scene = this.visualRegistry.getScene();
    if (!scene) return;

    this.parentNode = new BABYLON.TransformNode("juiceParticleRoot", scene);

    this.debrisMat = new BABYLON.PBRMaterial("debrisMat", scene);
    this.debrisMat.albedoColor = new BABYLON.Color3(0.1, 0.1, 0.15);
    this.debrisMat.emissiveColor = new BABYLON.Color3(0.9, 0.1, 0.1);
    this.debrisMat.emissiveIntensity = 3.5;
    this.debrisMat.metallic = 0.8;
    this.debrisMat.roughness = 0.4;

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

    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.PLAYER_DAMAGED, () => {
        const playerNode = this.visualRegistry.getTransformNode(this.refs.player);
        if (playerNode) {
          this.spawnBurst(playerNode.position, new BABYLON.Color3(0.13, 0.77, 0.36), 15);
        }
      })
    );

    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.WEAVER_DAMAGED, () => {
        const weaverNode = this.visualRegistry.getTransformNode(this.refs.weaver);
        if (weaverNode) {
          this.spawnBurst(weaverNode.position, new BABYLON.Color3(0.93, 0.22, 0.22), 20);
        }
      })
    );

    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.PLAYER_LANDED, (payload) => {
        const pos = new BABYLON.Vector3(payload.x, payload.y, 0);
        this.spawnLandingDust(pos);
      })
    );

    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.PLAYER_WALL_HIT, (payload) => {
        const pos = new BABYLON.Vector3(payload.x, payload.y, 0);
        this.spawnWallSparks(pos, payload.wallNormalX);
      })
    );

    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.PROJECTILE_IMPACT, (payload) => {
        const pos = new BABYLON.Vector3(payload.x, payload.y, 0);
        this.spawnWebSplat(pos);
      })
    );

    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.WEAVER_DIED, () => {
        const weaverNode = this.visualRegistry.getTransformNode(this.refs.weaver);
        if (weaverNode) {
          const sceneObj = this.visualRegistry.getScene();
          if (sceneObj) {
            this.spawnDeathDebris(weaverNode.position, sceneObj);
          }
          weaverNode.setEnabled(false);
        }
      })
    );

    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.clearDebris();
        const weaverNode = this.visualRegistry.getTransformNode(this.refs.weaver);
        if (weaverNode) {
          weaverNode.setEnabled(true);
        }
      })
    );
  }

  private spawnBurst(position: BABYLON.Vector3, color: BABYLON.Color3, count: number): void {
    for (let i = 0; i < count; i++) {
      const particle = this.particlePool[this.nextPoolIndex];
      particle.mesh.position.copyFrom(position);

      const theta = Math.random() * 2.0 * Math.PI;
      const r = 3.0 + Math.random() * 5.0;
      const vy = 4.0 + Math.random() * 8.0;
      const vz = (Math.random() - 0.5) * 4.0;

      particle.velocity.set(Math.cos(theta) * r, vy, vz);
      particle.lifeRemaining = 0.3 + Math.random() * 0.4;
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
    const count = 12;
    const color = new BABYLON.Color3(0.65, 0.65, 0.68);
    for (let i = 0; i < count; i++) {
      const particle = this.particlePool[this.nextPoolIndex];
      particle.mesh.position.copyFrom(position);

      const vx = (Math.random() - 0.5) * 6.0;
      const vy = Math.random() * 1.5;
      const vz = (Math.random() - 0.5) * 1.5;

      particle.velocity.set(vx, vy, vz);
      particle.lifeRemaining = 0.4 + Math.random() * 0.3;
      particle.maxLife = particle.lifeRemaining;
      particle.active = true;
      particle.mesh.setEnabled(true);

      const mat = particle.mesh.material as BABYLON.StandardMaterial;
      if (mat) mat.emissiveColor.copyFrom(color);

      this.nextPoolIndex = (this.nextPoolIndex + 1) % this.poolSize;
    }
  }

  private spawnWallSparks(position: BABYLON.Vector3, wallNormalX: number): void {
    const count = 8;
    const color = new BABYLON.Color3(1.0, 0.85, 0.35);
    for (let i = 0; i < count; i++) {
      const particle = this.particlePool[this.nextPoolIndex];
      particle.mesh.position.copyFrom(position);

      const vx = wallNormalX * (4.0 + Math.random() * 6.0);
      const vy = (Math.random() - 0.3) * 5.0;
      const vz = (Math.random() - 0.5) * 2.0;

      particle.velocity.set(vx, vy, vz);
      particle.lifeRemaining = 0.25 + Math.random() * 0.25;
      particle.maxLife = particle.lifeRemaining;
      particle.active = true;
      particle.mesh.setEnabled(true);

      const mat = particle.mesh.material as BABYLON.StandardMaterial;
      if (mat) mat.emissiveColor.copyFrom(color);

      this.nextPoolIndex = (this.nextPoolIndex + 1) % this.poolSize;
    }
  }

  private spawnWebSplat(position: BABYLON.Vector3): void {
    const count = 10;
    const color = new BABYLON.Color3(0.95, 0.95, 0.98);
    for (let i = 0; i < count; i++) {
      const particle = this.particlePool[this.nextPoolIndex];
      particle.mesh.position.copyFrom(position);

      const angle = Math.random() * Math.PI * 2.0;
      const speed = 2.0 + Math.random() * 4.0;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const vz = (Math.random() - 0.5) * 2.0;

      particle.velocity.set(vx, vy, vz);
      particle.lifeRemaining = 0.3 + Math.random() * 0.3;
      particle.maxLife = particle.lifeRemaining;
      particle.active = true;
      particle.mesh.setEnabled(true);

      const mat = particle.mesh.material as BABYLON.StandardMaterial;
      if (mat) mat.emissiveColor.copyFrom(color);

      this.nextPoolIndex = (this.nextPoolIndex + 1) % this.poolSize;
    }
  }

  private spawnDeathDebris(pos: BABYLON.Vector3, scene: BABYLON.Scene): void {
    if (!this.debrisMat) return;

    const weaverMesh = this.visualRegistry.getTransformNode(this.refs.weaver) as BABYLON.Mesh | null;
    const activeMat = weaverMesh?.material || this.debrisMat;
    const usePhysics = scene.isPhysicsEnabled();

    const count = 12;
    for (let i = 0; i < count; i++) {
      const size = 1.0 + Math.random() * 1.5;

      let chunk: BABYLON.Mesh;
      if (i % 2 === 0) {
        chunk = BABYLON.MeshBuilder.CreateCylinder(
          "debris_shard_" + Date.now() + "_" + i,
          { diameterTop: 0, diameterBottom: size, height: size * 1.2, tessellation: 5 },
          scene
        );
      } else {
        chunk = BABYLON.MeshBuilder.CreateBox(
          "debris_shard_" + Date.now() + "_" + i,
          { width: size, height: size * 0.4, depth: size },
          scene
        );
      }

      chunk.position.copyFrom(pos);
      chunk.position.x += (Math.random() - 0.5) * 1.2;
      chunk.position.y += (Math.random() - 0.5) * 1.2;
      chunk.material = activeMat;

      chunk.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      let agg: BABYLON.PhysicsAggregate | null = null;
      const vx = (Math.random() - 0.5) * 18.0;
      const vy = 5.0 + Math.random() * 14.0;
      const vz = (Math.random() - 0.5) * 8.0;

      const rx = (Math.random() - 0.5) * 12.0;
      const ry = (Math.random() - 0.5) * 12.0;
      const rz = (Math.random() - 0.5) * 12.0;

      if (usePhysics) {
        agg = new BABYLON.PhysicsAggregate(
          chunk,
          BABYLON.PhysicsShapeType.BOX,
          { mass: 3.0, friction: 0.5, restitution: 0.2 },
          scene
        );
        agg.body.setLinearVelocity(new BABYLON.Vector3(vx, vy, vz));
        agg.body.setAngularVelocity(new BABYLON.Vector3(rx, ry, rz));
      }

      this.activeDebrisList.push({
        mesh: chunk,
        aggregate: agg,
        velocity: new BABYLON.Vector3(vx, vy, vz),
        angularVelocity: new BABYLON.Vector3(rx, ry, rz),
        lifeRemaining: 5.0
      });
    }
  }

  public update(dt: number): void {
    const gravity = CANONICAL_UNITS.GRAVITY.JUICE_PARTICLE;
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
      p.mesh.position.x += p.velocity.x * dt;
      p.mesh.position.y += p.velocity.y * dt;
      p.mesh.position.z += p.velocity.z * dt;

      const ratio = p.lifeRemaining / p.maxLife;
      p.mesh.scaling.set(ratio, ratio, ratio);
    }

    for (let i = this.activeDebrisList.length - 1; i >= 0; i--) {
      const d = this.activeDebrisList[i];
      d.lifeRemaining -= dt;

      if (d.lifeRemaining <= 0) {
        if (d.aggregate) d.aggregate.dispose();
        d.mesh.dispose();
        this.activeDebrisList.splice(i, 1);
      } else {
        if (d.aggregate) {
          const pos = d.mesh.position;
          if (Math.abs(pos.z) > 0.01) {
            d.mesh.position.z = 0;
          }
          const vel = d.aggregate.body.getLinearVelocity();
          if (Math.abs(vel.z) > 0.01) {
            this.scratchVector.set(vel.x, vel.y, 0);
            d.aggregate.body.setLinearVelocity(this.scratchVector);
          }
        } else {
          d.velocity.y += CANONICAL_UNITS.GRAVITY.PLAYER_KINEMATIC * dt;
          d.mesh.position.x += d.velocity.x * dt;
          d.mesh.position.y += d.velocity.y * dt;
          d.mesh.rotation.x += d.angularVelocity.x * dt;
          d.mesh.rotation.y += d.angularVelocity.y * dt;
          d.mesh.rotation.z += d.angularVelocity.z * dt;
        }

        if (d.lifeRemaining < 1.5) {
          const ratio = d.lifeRemaining / 1.5;
          d.mesh.scaling.set(ratio, ratio, ratio);
        }
      }
    }
  }

  private clearDebris(): void {
    for (const d of this.activeDebrisList) {
      if (d.aggregate) d.aggregate.dispose();
      d.mesh.dispose();
    }
    this.activeDebrisList = [];
  }

  public dispose(): void {
    this.unsubscribes.forEach((unsub) => unsub());
    this.unsubscribes = [];
    this.clearDebris();
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
