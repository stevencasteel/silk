import { VISUAL_JUICE_CONFIG, CANONICAL_UNITS } from "../../core/engine/ArenaConfig";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { ParticleRequestComponent } from "../../core/ecs/Components";
import * as BABYLON from "@babylonjs/core";
import { IParticleEmitContext } from "./ParticleStrategies";

interface PooledParticle {
  mesh: BABYLON.Mesh;
  velocity: BABYLON.Vector3;
  lifeRemaining: number;
  maxLife: number;
  active: boolean;
}

export class JuiceSystem implements ISystem, IParticleEmitContext {
  readonly phase = SystemPhase.RenderSync;

  private particlePool: PooledParticle[] = [];
  private poolSize = 64;
  private nextPoolIndex = 0;
  private parentNode: BABYLON.TransformNode | null = null;

  private readonly _particleOriginScratch = new BABYLON.Vector3();

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
  }

  public emitRawParticle(
    position: BABYLON.Vector3,
    velocity: BABYLON.Vector3,
    life: number,
    color: BABYLON.Color3
  ): void {
    const particle = this.particlePool[this.nextPoolIndex];
    particle.mesh.position.copyFrom(position);
    particle.velocity.copyFrom(velocity);
    particle.lifeRemaining = life;
    particle.maxLife = life;
    particle.active = true;
    particle.mesh.setEnabled(true);

    const mat = particle.mesh.material as BABYLON.StandardMaterial;
    if (mat) {
      mat.emissiveColor.copyFrom(color);
    }

    this.nextPoolIndex = (this.nextPoolIndex + 1) % this.poolSize;
  }

  public update(dt: number): void {
    const gravity = CANONICAL_UNITS.GRAVITY.JUICE_PARTICLE;
    const particleDrag = Math.pow(VISUAL_JUICE_CONFIG.PARTICLES.DRAG, dt * 60.0);

    const reqStore = this.context.stores.get<ParticleRequestComponent>("particleRequest");
    for (const [id, req] of reqStore.entries()) {
      if (req.strategy) {
        this._particleOriginScratch.set(req.x, req.y, req.z);
        req.strategy.emit(this, this._particleOriginScratch);
      }
      this.context.world.destroy(id);
    }

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

      const speed = p.velocity.length();
      if (speed > 10.0) {
        if (!p.mesh.rotationQuaternion) {
          p.mesh.rotationQuaternion = new BABYLON.Quaternion();
        }
        const angle = Math.atan2(p.velocity.y, p.velocity.x) - Math.PI / 2;
        BABYLON.Quaternion.RotationAxisToRef(BABYLON.Axis.Z, angle, p.mesh.rotationQuaternion);
        const stretch = 1.0 + (speed / 10.0) * 0.5;
        p.mesh.scaling.set(0.25 * ratio, 2.0 * stretch * ratio, 0.25 * ratio);
      } else {
        if (p.mesh.rotationQuaternion) {
          p.mesh.rotationQuaternion.set(0, 0, 0, 1);
        }
        p.mesh.scaling.set(ratio, ratio, ratio);
      }
    }
  }

  public dispose(): void {
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
