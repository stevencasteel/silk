import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { TransformComponent } from "../../core/ecs/Components";
import { ARENA_CONFIG, CANONICAL_UNITS } from "../../core/engine/ArenaConfig";
import * as BABYLON from "@babylonjs/core";

interface ActiveWebDebris {
  mesh: BABYLON.Mesh;
  velocity: BABYLON.Vector3;
  angularVelocity: BABYLON.Vector3;
  lifeRemaining: number;
  initialScale: BABYLON.Vector3;
}

export class WebShatterSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  readonly initPhase = InitPhase.Gameplay;

  private activeDebrisList: ActiveWebDebris[] = [];
  private pooledMeshes: BABYLON.Mesh[] = [];
  private debrisMat: BABYLON.PBRMaterial | null = null;
  private onWebBreakListener: (() => void) | null = null;

  private readonly MAX_DEBRIS = 12;
  private readonly LIFESPAN = 1.2;

  constructor(private context: SystemContext) {}

  public init(): void {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return;

    this.debrisMat = new BABYLON.PBRMaterial("webShatterMat", scene);
    this.debrisMat.albedoColor = new BABYLON.Color3(0.95, 0.95, 0.98);
    this.debrisMat.metallic = 0.1;
    this.debrisMat.roughness = 0.65;
    this.debrisMat.sheen.isEnabled = true;
    this.debrisMat.sheen.intensity = 0.85;

    for (let i = 0; i < this.MAX_DEBRIS; i++) {
      const name = `web_shatter_debris_${i}`;
      let mesh: BABYLON.Mesh;

      if (i % 2 === 0) {
        mesh = BABYLON.MeshBuilder.CreateSphere(name, { diameter: 0.35, segments: 1 }, scene);
      } else {
        mesh = BABYLON.MeshBuilder.CreateBox(name, { size: 0.32 }, scene);
      }

      mesh.material = this.debrisMat;
      mesh.setEnabled(false);
      mesh.isVisible = false;
      this.context.visualRegistration.registerShadowCaster(mesh);
      this.pooledMeshes.push(mesh);
    }

    this.onWebBreakListener = () => {
      this.spawnDebris();
    };

    window.addEventListener("silk-web-break", this.onWebBreakListener);
  }

  private spawnDebris(): void {
    const pId = this.context.refs.player;
    const transforms = this.context.stores.get<TransformComponent>("transform");
    const pTrans = transforms.get(pId);
    if (!pTrans) return;

    this.clearDebris();

    for (let i = 0; i < this.MAX_DEBRIS; i++) {
      const mesh = this.pooledMeshes[i];
      mesh.position.set(
        pTrans.x + (Math.random() - 0.5) * 0.4,
        pTrans.y + (Math.random() - 0.5) * 0.8,
        pTrans.z + (Math.random() - 0.5) * 0.2
      );

      const rScaleX = 0.75 + Math.random() * 0.6;
      const rScaleY = 0.75 + Math.random() * 0.6;
      const rScaleZ = 0.75 + Math.random() * 0.6;
      mesh.scaling.set(rScaleX, rScaleY, rScaleZ);
      mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );

      mesh.setEnabled(true);
      mesh.isVisible = true;

      const angle = Math.random() * Math.PI * 2;
      const speed = 4.0 + Math.random() * 6.0;
      const vx = Math.cos(angle) * speed;
      const vy = (Math.random() - 0.2) * 4.0 - 5.0; 
      const vz = (Math.random() - 0.5) * 1.5;

      const rotVelX = (Math.random() - 0.5) * 12.0;
      const rotVelY = (Math.random() - 0.5) * 12.0;
      const rotVelZ = (Math.random() - 0.5) * 12.0;

      this.activeDebrisList.push({
        mesh,
        velocity: new BABYLON.Vector3(vx, vy, vz),
        angularVelocity: new BABYLON.Vector3(rotVelX, rotVelY, rotVelZ),
        lifeRemaining: this.LIFESPAN * (0.8 + Math.random() * 0.4),
        initialScale: new BABYLON.Vector3(rScaleX, rScaleY, rScaleZ)
      });
    }
  }

  public update(dt: number): void {
    const wallLimit = ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;
    const drag = Math.pow(0.94, dt * 60.0);

    for (let i = this.activeDebrisList.length - 1; i >= 0; i--) {
      const d = this.activeDebrisList[i];
      d.lifeRemaining -= dt;

      if (d.lifeRemaining <= 0) {
        d.mesh.setEnabled(false);
        d.mesh.isVisible = false;
        this.activeDebrisList.splice(i, 1);
      } else {
        const ratio = Math.max(0, d.lifeRemaining / this.LIFESPAN);
        d.mesh.scaling.set(
          d.initialScale.x * ratio,
          d.initialScale.y * ratio,
          d.initialScale.z * ratio
        );

        d.velocity.y += CANONICAL_UNITS.GRAVITY.PLAYER_KINEMATIC * dt * 0.8;
        d.velocity.x *= drag;
        d.velocity.z *= drag;

        d.mesh.position.x += d.velocity.x * dt;
        d.mesh.position.y += d.velocity.y * dt;
        d.mesh.position.z += d.velocity.z * dt;

        d.mesh.rotation.x += d.angularVelocity.x * dt;
        d.mesh.rotation.y += d.angularVelocity.y * dt;
        d.mesh.rotation.z += d.angularVelocity.z * dt;

        if (d.mesh.position.x < -wallLimit) {
          d.mesh.position.x = -wallLimit;
          d.velocity.x *= -0.55;
        } else if (d.mesh.position.x > wallLimit) {
          d.mesh.position.x = wallLimit;
          d.velocity.x *= -0.55;
        }
      }
    }
  }

  private clearDebris(): void {
    this.activeDebrisList.forEach((d) => {
      d.mesh.setEnabled(false);
      d.mesh.isVisible = false;
    });
    this.activeDebrisList = [];
  }

  public dispose(): void {
    if (this.onWebBreakListener) {
      window.removeEventListener("silk-web-break", this.onWebBreakListener);
      this.onWebBreakListener = null;
    }
    this.clearDebris();
    this.pooledMeshes.forEach((mesh) => mesh.dispose());
    this.pooledMeshes = [];
    if (this.debrisMat) {
      this.debrisMat.dispose();
      this.debrisMat = null;
    }
  }
}
