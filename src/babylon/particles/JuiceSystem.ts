import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
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

  constructor(
    private broker: EventBroker,
    private visualRegistry: IVisualRegistry
  ) {}

  public init(): void {
    const scene = this.visualRegistry.getScene();
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

    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.PLAYER_DAMAGED, () => {
        const scene = this.visualRegistry.getScene();
        if (!scene) return;
        const playerMesh = scene.getMeshByName("playerVisual");
        if (playerMesh) {
          this.spawnBurst(playerMesh.position, new BABYLON.Color3(0.13, 0.77, 0.36), 15);
        }
      })
    );

    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.SPIDER_DAMAGED, () => {
        const scene = this.visualRegistry.getScene();
        if (!scene) return;
        const spiderMesh = scene.getMeshByName("spiderVisual");
        if (spiderMesh) {
          this.spawnBurst(spiderMesh.position, new BABYLON.Color3(0.93, 0.22, 0.22), 20);
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

  public update(dt: number): void {
    const gravity = -18.0;
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
  }

  public dispose(): void {
    this.unsubscribes.forEach(unsub => unsub());
    this.unsubscribes = [];
    if (this.parentNode) {
      this.parentNode.dispose();
    }
    this.particlePool.forEach(p => {
      p.mesh.dispose();
      if (p.mesh.material) p.mesh.material.dispose();
    });
    this.particlePool = [];
  }
}
