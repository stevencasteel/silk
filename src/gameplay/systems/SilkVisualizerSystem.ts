import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent, SilkComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import * as BABYLON from "@babylonjs/core";

export class SilkVisualizerSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;

  private readonly SEGMENTS = 24;
  private readonly MAX_SAG = 3.8;
  private readonly BASE_RADIUS = 0.07;
  private readonly MAX_RADIUS = 0.13;

  private silkMesh: BABYLON.Mesh | null = null;
  private silkMat: BABYLON.PBRMaterial | null = null;
  private points: BABYLON.Vector3[] = [];

  private scratchAnchor = new BABYLON.Vector3();
  private scratchPlayer = new BABYLON.Vector3();
  private scratchCtrl = new BABYLON.Vector3();
  private scratchPt = new BABYLON.Vector3();

  private vibPhase = 0;

  constructor(
    private refs: EntityRefs,
    private transforms: ComponentStore<TransformComponent>,
    private silks: ComponentStore<SilkComponent>,
    private visualRegistry: IVisualRegistry
  ) {
    for (let i = 0; i <= this.SEGMENTS; i++) {
      this.points.push(new BABYLON.Vector3(0, 0, 0));
    }
  }

  public init(): void {
    const scene = this.visualRegistry.getScene();
    if (!scene) return;

    this.silkMat = new BABYLON.PBRMaterial("silkMat", scene);
    this.silkMat.metallic = 0.0;
    this.silkMat.roughness = 0.6;
    this.silkMat.sheen.isEnabled = true;
    this.silkMat.sheen.intensity = 0.8;
    this.silkMat.sheen.roughness = 0.3;
    this.silkMat.emissiveIntensity = 2.5;
    this.silkMat.albedoColor = new BABYLON.Color3(0.6, 0.85, 1.0);
    this.silkMat.emissiveColor = new BABYLON.Color3(0.2, 0.45, 0.7);
    this.silkMat.disableLighting = false;

    this.silkMesh = BABYLON.MeshBuilder.CreateTube(
      "tetherTube",
      {
        path: this.points,
        radius: this.BASE_RADIUS,
        tessellation: 8,
        cap: BABYLON.Mesh.NO_CAP,
        updatable: true
      },
      scene
    );
    this.silkMesh.material = this.silkMat;
  }

  public render(alpha: number): void {
    if (!this.silkMesh || !this.silkMat) return;

    const pTrans = this.transforms.get(this.refs.player);
    const silk = this.silks.get(this.refs.player);
    if (!pTrans || !silk || !silk.isAttached) {
      if (this.silkMesh) this.silkMesh.setEnabled(false);
      return;
    }
    this.silkMesh.setEnabled(true);

    const px = pTrans.prevX + (pTrans.x - pTrans.prevX) * alpha;
    const py = pTrans.prevY + (pTrans.y - pTrans.prevY) * alpha;
    this.scratchPlayer.set(px, py, 0);

    this.scratchAnchor.set(silk.anchorX, silk.anchorY, silk.anchorZ);

    const tension = Math.max(0, Math.min(1, silk.tension));

    this.vibPhase += 0.18;
    const vibAmp = Math.max(0, tension - 0.7) * 0.35;
    const vibOffset = Math.sin(this.vibPhase * 14) * vibAmp;

    const midX = (this.scratchAnchor.x + this.scratchPlayer.x) * 0.5;
    const midY = (this.scratchAnchor.y + this.scratchPlayer.y) * 0.5;
    const sag = this.MAX_SAG * (1.0 - tension) + vibOffset;
    this.scratchCtrl.set(midX, midY - sag, 0.35);

    for (let i = 0; i <= this.SEGMENTS; i++) {
      const t = i / this.SEGMENTS;
      const t1 = 1 - t;
      const pt = this.points[i];
      pt.x =
        t1 * t1 * this.scratchAnchor.x +
        2 * t1 * t * this.scratchCtrl.x +
        t * t * this.scratchPlayer.x;
      pt.y =
        t1 * t1 * this.scratchAnchor.y +
        2 * t1 * t * this.scratchCtrl.y +
        t * t * this.scratchPlayer.y;
      pt.z =
        t1 * t1 * this.scratchAnchor.z +
        2 * t1 * t * this.scratchCtrl.z +
        t * t * this.scratchPlayer.z;

      pt.z += Math.sin((i / this.SEGMENTS) * Math.PI * 2.5) * 0.12;
    }

    const radius = this.BASE_RADIUS + tension * (this.MAX_RADIUS - this.BASE_RADIUS);
    this.silkMesh = BABYLON.MeshBuilder.CreateTube("tetherTube", {
      path: this.points,
      radius: radius,
      tessellation: 8,
      cap: BABYLON.Mesh.NO_CAP,
      instance: this.silkMesh
    });

    const r = tension < 0.5 ? 0.55 + tension * 0.9 : 1.0;
    const g = tension < 0.5 ? 0.78 + tension * 0.44 : 1.0 - (tension - 0.5) * 1.1;
    const b = tension < 0.5 ? 1.0 - tension * 0.2 : 0.9 - (tension - 0.5) * 1.7;

    this.silkMat.albedoColor.set(
      Math.max(0, Math.min(1, r)),
      Math.max(0, Math.min(1, g)),
      Math.max(0, Math.min(1, b))
    );

    const eBrightness = 0.1 + tension * 0.5;
    this.silkMat.emissiveColor.set(
      eBrightness * (0.3 + tension * 0.7),
      eBrightness * (0.6 - tension * 0.4),
      eBrightness * (1.0 - tension * 0.9)
    );

    this.scratchPt.set(0, 0, 0);
  }

  public dispose(): void {
    if (this.silkMesh) {
      this.silkMesh.dispose();
      this.silkMesh = null;
    }
    if (this.silkMat) {
      this.silkMat.dispose();
      this.silkMat = null;
    }
  }
}
