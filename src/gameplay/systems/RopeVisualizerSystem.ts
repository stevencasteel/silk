import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent, TetherComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import * as BABYLON from "@babylonjs/core";

export class RopeVisualizerSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private ropeMesh: BABYLON.Mesh | null = null;
  private ropeMat: BABYLON.StandardMaterial | null = null;
  private segments = 24;
  private points: BABYLON.Vector3[] = [];
  private scratchAnchor = new BABYLON.Vector3();
  private scratchPlayer = new BABYLON.Vector3();
  private scratchLerp = new BABYLON.Vector3();

  constructor(
    private refs: EntityRefs,
    private transforms: ComponentStore<TransformComponent>,
    private tethers: ComponentStore<TetherComponent>,
    private visualRegistry: IVisualRegistry
  ) {
    for (let i = 0; i <= this.segments; i++) {
      this.points.push(new BABYLON.Vector3(0, 0, 0));
    }
  }

  public init(): void {
    const scene = this.visualRegistry.getScene();
    if (!scene) return;

    this.ropeMat = new BABYLON.StandardMaterial("ropeMat", scene);
    this.ropeMat.diffuseColor = new BABYLON.Color3(0.8, 0.9, 1.0);
    this.ropeMat.emissiveColor = new BABYLON.Color3(0.2, 0.4, 0.6);
    this.ropeMat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);

    this.ropeMesh = BABYLON.MeshBuilder.CreateTube("tetherTube", {
      path: this.points,
      radius: 0.08,
      tessellation: 8,
      cap: BABYLON.Mesh.NO_CAP,
      updatable: true
    }, scene);
    this.ropeMesh.material = this.ropeMat;
  }

  public render(alpha: number): void {
    if (!this.ropeMesh || !this.ropeMat) return;
    const pTrans = this.transforms.get(this.refs.player);
    const aTrans = this.transforms.get(this.refs.anchor);
    const tether = this.tethers.get(this.refs.player);
    if (!pTrans || !aTrans || !tether) return;

    if (!tether.isAttached) {
      this.ropeMesh.setEnabled(false);
      return;
    }
    this.ropeMesh.setEnabled(true);

    const px = pTrans.prevX + (pTrans.x - pTrans.prevX) * alpha;
    const py = pTrans.prevY + (pTrans.y - pTrans.prevY) * alpha;
    this.scratchPlayer.set(px, py, 0);
    this.scratchAnchor.set(aTrans.x, aTrans.y, aTrans.z);

    const clampedTension = Math.max(0, Math.min(1, tether.currentLength / tether.maxLength));
    const sagFactor = (1.0 - clampedTension) * 2.5;
    const applySag = clampedTension < 0.95;

    for (let i = 0; i <= this.segments; i++) {
      const ratio = i / this.segments;
      BABYLON.Vector3.LerpToRef(this.scratchAnchor, this.scratchPlayer, ratio, this.scratchLerp);
      if (applySag) {
        this.scratchLerp.y -= Math.sin(ratio * Math.PI) * sagFactor;
      }
      const targetPoint = this.points[i];
      targetPoint.x = this.scratchLerp.x;
      targetPoint.y = this.scratchLerp.y;
      targetPoint.z = this.scratchLerp.z;
    }

    const radius = 0.12 - (clampedTension * 0.07);
    this.ropeMesh = BABYLON.MeshBuilder.CreateTube("tetherTube", {
      path: this.points,
      radius: radius,
      tessellation: 8,
      cap: BABYLON.Mesh.NO_CAP,
      instance: this.ropeMesh
    });

    if (clampedTension > 0.8) {
      const t = (clampedTension - 0.8) / 0.2;
      this.ropeMat.emissiveColor.r = 0.2 + t * 0.8;
      this.ropeMat.emissiveColor.g = 0.4 - t * 0.3;
      this.ropeMat.emissiveColor.b = 0.6 - t * 0.5;
    } else {
      this.ropeMat.emissiveColor.r = 0.2;
      this.ropeMat.emissiveColor.g = 0.4;
      this.ropeMat.emissiveColor.b = 0.6;
    }
  }

  public dispose(): void {
    if (this.ropeMesh) this.ropeMesh.dispose();
    if (this.ropeMat) this.ropeMat.dispose();
  }
}
