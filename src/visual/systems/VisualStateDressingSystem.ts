import { ColorCache, solveScaleSpring } from "../../core/utils/EngineUtils";
import { RasterShearPlugin } from "../lighting/RasterShearPlugin";
import { VISUAL_JUICE_CONFIG } from "../../core/engine/ArenaConfig";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  TetherComponent,
  TraversalStateComponent,
  TransformComponent,
  PlayerCosmeticComponent,
  WeaverCosmeticComponent,
  WeaverAIComponent
} from "../../core/ecs/Components";
import * as BABYLON from "@babylonjs/core";

interface CachedBodyParts {
  abdomen: BABYLON.TransformNode;
  cephalothorax: BABYLON.TransformNode;
  head: BABYLON.TransformNode;
}

export class VisualStateDressingSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;

  private currentEmissiveColor = new BABYLON.Color3(0.05, 0.15, 0.05);
  private readonly _targetEmissiveColor = new BABYLON.Color3();

  private visualClock = 0.0;

  private readonly _weaverTargetQuat = new BABYLON.Quaternion();
  private readonly _weaverCurrentQuat = new BABYLON.Quaternion();

  constructor(private context: SystemContext) {}

  public update(dt: number): void {
    this.visualClock += dt;

    const wAI = this.context.stores
      .get<WeaverAIComponent>("weaverAI")
      .get(this.context.refs.weaver);
    const transStore = this.context.stores.get<TransformComponent>("transform");
    const wTrans = transStore.get(this.context.refs.weaver);
    const cosmetic = this.context.stores
      .get<WeaverCosmeticComponent>("weaverCosmetic")
      .get(this.context.refs.weaver);

    if (wAI) {
      wAI.damageShearTime += dt;
      if (wAI.damageShearIntensity > 0.0) {
        wAI.damageShearIntensity = Math.max(0.0, wAI.damageShearIntensity - dt * 1.75);
      }
    }

    if (wTrans && cosmetic) {
      wTrans.prevScaleX = wTrans.scaleX!;
      wTrans.prevScaleY = wTrans.scaleY!;
      wTrans.prevScaleZ = wTrans.scaleZ!;

      solveScaleSpring(
        wTrans,
        cosmetic.targetScaleX,
        cosmetic.targetScaleY,
        cosmetic.targetScaleZ,
        dt,
        cosmetic.springStiffness,
        cosmetic.springDamping
      );

      this._weaverTargetQuat.set(0, 0, 0, 1);
      if (cosmetic.rotationAngle !== 0) {
        BABYLON.Quaternion.RotationAxisToRef(
          BABYLON.Axis.Z,
          cosmetic.rotationAngle,
          this._weaverTargetQuat
        );
      } else if (cosmetic.wobbleAngle !== 0) {
        BABYLON.Quaternion.RotationYawPitchRollToRef(
          0,
          0,
          cosmetic.wobbleAngle,
          this._weaverTargetQuat
        );
      }

      this._weaverCurrentQuat.set(wTrans.qx, wTrans.qy, wTrans.qz, wTrans.qw);
      BABYLON.Quaternion.SlerpToRef(
        this._weaverCurrentQuat,
        this._weaverTargetQuat,
        cosmetic.rotationSpeed * dt,
        this._weaverCurrentQuat
      );
      wTrans.qx = this._weaverCurrentQuat.x;
      wTrans.qy = this._weaverCurrentQuat.y;
      wTrans.qz = this._weaverCurrentQuat.z;
      wTrans.qw = this._weaverCurrentQuat.w;
    }
  }

  public render(): void {
    this.updateAestheticDressing();
  }

  private updateAestheticDressing(): void {
    const tether = this.context.stores.get<TetherComponent>("tether").get(this.context.refs.player);
    const trav = this.context.stores
      .get<TraversalStateComponent>("traversal")
      .get(this.context.refs.player);
    const wAI = this.context.stores
      .get<WeaverAIComponent>("weaverAI")
      .get(this.context.refs.weaver);
    const pCosmetic = this.context.stores
      .get<PlayerCosmeticComponent>("playerCosmetic")
      .get(this.context.refs.player);
    const wCosmetic = this.context.stores
      .get<WeaverCosmeticComponent>("weaverCosmetic")
      .get(this.context.refs.weaver);
    const emissive = VISUAL_JUICE_CONFIG.EMISSIVE;

    const pNode = this.context.visualRegistry.getTransformNode(this.context.refs.player);
    if (pNode && tether && trav && pCosmetic) {
      const mesh = pNode as BABYLON.AbstractMesh;

      const pbrMaterials: BABYLON.PBRMaterial[] = [];
      if (mesh.material instanceof BABYLON.PBRMaterial) {
        pbrMaterials.push(mesh.material);
      }
      mesh.getChildMeshes().forEach((child) => {
        if (
          child.material instanceof BABYLON.PBRMaterial &&
          !pbrMaterials.includes(child.material)
        ) {
          pbrMaterials.push(child.material);
        }
      });

      pbrMaterials.forEach((mat) => {
        this._targetEmissiveColor.set(
          pCosmetic.emissiveR,
          pCosmetic.emissiveG,
          pCosmetic.emissiveB
        );
        BABYLON.Color3.LerpToRef(
          this.currentEmissiveColor,
          this._targetEmissiveColor,
          emissive.PLAYER_LERP_RATE,
          this.currentEmissiveColor
        );

        mat.emissiveColor.set(
          this.currentEmissiveColor.r * emissive.PLAYER_EMISSIVE_SCALE,
          this.currentEmissiveColor.g * emissive.PLAYER_EMISSIVE_SCALE,
          this.currentEmissiveColor.b * emissive.PLAYER_EMISSIVE_SCALE
        );
      });
    }

    const wNode = this.context.visualRegistry.getTransformNode(this.context.refs.weaver);
    if (wNode && wAI && wCosmetic) {
      const mesh = wNode as BABYLON.AbstractMesh;

      const pbrMaterials: BABYLON.PBRMaterial[] = [];
      if (mesh.material instanceof BABYLON.PBRMaterial) {
        pbrMaterials.push(mesh.material);
      }
      mesh.getChildMeshes().forEach((child) => {
        if (
          child.material instanceof BABYLON.PBRMaterial &&
          !pbrMaterials.includes(child.material)
        ) {
          pbrMaterials.push(child.material);
        }
      });

      const pulse =
        emissive.WEAVER_EMISSIVE_PULSE_BASE +
        Math.sin(this.visualClock * 5.5) * emissive.WEAVER_EMISSIVE_PULSE_AMP;

      const cachedColor = ColorCache.getColor(wCosmetic.emissiveHue);

      pbrMaterials.forEach((pbrMat) => {
        let scale = emissive.WEAVER_EMISSIVE_SCALE * 0.42;
        if (pbrMat.name === "legMat") {
          scale *= 0.24;
        }

        pbrMat.emissiveColor.set(
          cachedColor.r * scale + pulse * 0.12,
          cachedColor.g * scale,
          cachedColor.b * scale
        );

        const shearPlugin = (pbrMat as BABYLON.PBRMaterial & { _shearPlugin?: RasterShearPlugin })
          ._shearPlugin;
        if (shearPlugin) {
          shearPlugin.shearIntensity = wAI.damageShearIntensity;
          shearPlugin.shearTime = wAI.damageShearTime;
        }
      });

      let parts = mesh.metadata?.cachedBodyParts as CachedBodyParts | undefined;
      if (!parts) {
        const abdomen = mesh.getChildren(
          (node) => node.name === "weaver_abdomen",
          false
        )[0] as BABYLON.TransformNode;
        const cephalothorax = mesh.getChildren(
          (node) => node.name === "weaver_cephalothorax",
          false
        )[0] as BABYLON.TransformNode;
        const head = mesh.getChildren(
          (node) => node.name === "weaver_head",
          false
        )[0] as BABYLON.TransformNode;

        parts = { abdomen, cephalothorax, head };
        if (!mesh.metadata) {
          mesh.metadata = {};
        }
        mesh.metadata.cachedBodyParts = parts;
      }

      const bodySway = Math.sin(this.visualClock * 4.0) * 0.05 * 0.16;
      const bodyBob = Math.cos(this.visualClock * 8.0) * 1.5 * 0.008;

      this.animateBodyPart(parts.abdomen, bodySway, bodyBob * 0.55, 0.55);
      this.animateBodyPart(parts.cephalothorax, -bodySway * 0.45, bodyBob * 0.35, 0.28);
      this.animateBodyPart(parts.head, -bodySway * 0.7, bodyBob * 0.45, 0.4);
    }
  }

  private animateBodyPart(
    node: BABYLON.Node | null | undefined,
    sway: number,
    bobZ: number,
    rotationScale: number
  ): void {
    if (!(node instanceof BABYLON.TransformNode)) return;

    let meta = node.metadata as {
      baseX?: number;
      baseY?: number;
      baseZ?: number;
    } | null;

    if (!meta || meta.baseX === undefined || meta.baseY === undefined || meta.baseZ === undefined) {
      meta = {
        ...(meta ?? {}),
        baseX: node.position.x,
        baseY: node.position.y,
        baseZ: node.position.z
      };
      node.metadata = meta;
    }

    const baseX = meta.baseX ?? node.position.x;
    const baseY = meta.baseY ?? node.position.y;
    const baseZ = meta.baseZ ?? node.position.z;

    node.position.x = baseX + sway * 0.08;
    node.position.y = baseY + Math.abs(sway) * 0.035;
    node.position.z = baseZ + bobZ;
    node.rotation.z = sway * rotationScale;
  }
}
