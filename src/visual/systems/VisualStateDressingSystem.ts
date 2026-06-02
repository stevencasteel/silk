import {
  ColorCache,
  solveSpringDamper,
  solveScaleSpring,
  collectPBRMaterials
} from "../../core/utils/EngineUtils";
import { SilkMaterialPlugin } from "../lighting/SilkMaterialPlugin";
import { VISUAL_JUICE_CONFIG } from "../../core/engine/ArenaConfig";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  ActorCosmeticComponent,
  WeaverAIComponent,
  TransformComponent,
  TraversalStateComponent
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

  constructor(private context: SystemContext) {}

  public update(dt: number): void {
    this.visualClock += dt;

    const wAI = this.context.stores
      .get<WeaverAIComponent>("weaverAI")
      .get(this.context.refs.weaver);
    const cosmetics = this.context.stores.get<ActorCosmeticComponent>("cosmetic");
    const transformStore = this.context.stores.get<TransformComponent>("transform");

    if (wAI) {
      wAI.damageShearTime += dt;
      if (wAI.damageShearIntensity > 0.0) {
        wAI.damageShearIntensity = Math.max(0.0, wAI.damageShearIntensity - dt * 1.75);
      }
    }

    const weaverId = this.context.refs.weaver;
    const cosmetic = cosmetics.get(weaverId);
    const wTrans = transformStore.get(weaverId);

    if (cosmetic && wTrans) {
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

      const currentRoll = cosmetic.currentRoll ?? 0;
      const rollVel = cosmetic.rollVel ?? 0;
      const rollSpring = solveSpringDamper(
        currentRoll,
        cosmetic.rotationAngle,
        rollVel,
        dt,
        cosmetic.springStiffness * 0.6,
        cosmetic.springDamping
      );
      cosmetic.currentRoll = rollSpring.value;
      cosmetic.rollVel = rollSpring.velocity;

      const currentWobble = cosmetic.currentWobble ?? 0;
      const wobbleVel = cosmetic.wobbleVel ?? 0;
      const wobbleSpring = solveSpringDamper(
        currentWobble,
        cosmetic.wobbleAngle ?? 0,
        wobbleVel,
        dt,
        cosmetic.springStiffness * 0.8,
        cosmetic.springDamping
      );
      cosmetic.currentWobble = wobbleSpring.value;
      cosmetic.wobbleVel = wobbleSpring.velocity;

      BABYLON.Quaternion.RotationYawPitchRollToRef(
        0,
        0,
        cosmetic.currentWobble,
        this._weaverTargetQuat
      );
      const rollQuat = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, cosmetic.currentRoll);
      this._weaverTargetQuat.multiplyInPlace(rollQuat);

      wTrans.qx = this._weaverTargetQuat.x;
      wTrans.qy = this._weaverTargetQuat.y;
      wTrans.qz = this._weaverTargetQuat.z;
      wTrans.qw = this._weaverTargetQuat.w;
    }

    this.updateAestheticDressing(dt);
  }

  public render(): void {}

  private updateAestheticDressing(dt: number): void {
    const cosmetics = this.context.stores.get<ActorCosmeticComponent>("cosmetic");
    const pId = this.context.refs.player;
    const wId = this.context.refs.weaver;

    const pCosmetic = cosmetics.get(pId);
    if (pCosmetic) {
      const pNode = this.context.visualQuery.getTransformNode(pId);
      if (pNode instanceof BABYLON.AbstractMesh) {
        const pbrMaterials = collectPBRMaterials(pNode);

        const travs = this.context.stores.get<TraversalStateComponent>("traversal");
        const pTrav = travs ? travs.get(pId) : undefined;
        
        if (pNode.metadata && pNode.metadata.trailMesh) {
            const trailMat = pNode.metadata.trailMesh.material as BABYLON.StandardMaterial;
            const targetAlpha = (pTrav && pTrav.state === "LAUNCHING") ? 0.85 : 0.0;
            trailMat.alpha += (targetAlpha - trailMat.alpha) * (1.0 - Math.exp(-dt * 15.0));
        }

        const flashMax = 0.35;
        const flashAlpha = (pTrav && pTrav.isWebTrapped && pTrav.webFlashTimer !== undefined)
          ? Math.min(1.0, pTrav.webFlashTimer / flashMax)
          : 0.0;

        const emissive = VISUAL_JUICE_CONFIG.EMISSIVE;
        pbrMaterials.forEach((mat) => {
          this._targetEmissiveColor.set(
            pCosmetic.emissiveR ?? 0.1,
            pCosmetic.emissiveG ?? 0.0,
            pCosmetic.emissiveB ?? 0.2
          );
          const playerLerpFactor = 1.0 - Math.exp(-dt * 12.0);
          BABYLON.Color3.LerpToRef(
            this.currentEmissiveColor,
            this._targetEmissiveColor,
            playerLerpFactor,
            this.currentEmissiveColor
          );

          const finalEmissiveR = this.currentEmissiveColor.r * emissive.PLAYER_EMISSIVE_SCALE;
          const finalEmissiveG = this.currentEmissiveColor.g * emissive.PLAYER_EMISSIVE_SCALE;
          const finalEmissiveB = this.currentEmissiveColor.b * emissive.PLAYER_EMISSIVE_SCALE;

          let baseAlbedoR = 0.95;
          let baseAlbedoG = 0.95;
          let baseAlbedoB = 1.0;

          if (mat.name === "playerInnerMat") {
            baseAlbedoR = 0.04;
            baseAlbedoG = 0.01;
            baseAlbedoB = 0.08;
          } else if (mat.name === "playerBandMat" || mat.name === "playerKnotMat") {
            baseAlbedoR = 1.0;
            baseAlbedoG = 1.0;
            baseAlbedoB = 1.0;
          }

          if (flashAlpha > 0) {
            const flashR = 0.01;
            const flashG = 0.01;
            const flashB = 0.01;

            mat.albedoColor.set(
              baseAlbedoR * (1.0 - flashAlpha) + flashR * flashAlpha,
              baseAlbedoG * (1.0 - flashAlpha) + flashG * flashAlpha,
              baseAlbedoB * (1.0 - flashAlpha) + flashB * flashAlpha
            );

            mat.emissiveColor.set(
              finalEmissiveR * (1.0 - flashAlpha),
              finalEmissiveG * (1.0 - flashAlpha),
              finalEmissiveB * (1.0 - flashAlpha)
            );
          } else {
            mat.albedoColor.set(baseAlbedoR, baseAlbedoG, baseAlbedoB);
            mat.emissiveColor.set(finalEmissiveR, finalEmissiveG, finalEmissiveB);
          }
        });
      }
    }

    const wCosmetic = cosmetics.get(wId);
    const wAI = this.context.stores.get<WeaverAIComponent>("weaverAI").get(wId);

    if (wCosmetic) {
      const wNode = this.context.visualQuery.getTransformNode(wId);
      if (wNode instanceof BABYLON.AbstractMesh) {
        const pbrMaterials = collectPBRMaterials(wNode);

        const emissive = VISUAL_JUICE_CONFIG.EMISSIVE;
        const pulse =
          emissive.WEAVER_EMISSIVE_PULSE_BASE +
          Math.sin(this.visualClock * 5.5) * emissive.WEAVER_EMISSIVE_PULSE_AMP;

        const isYellowTelegraph = wCosmetic.emissiveHue === "#dffe00";
        const cachedColor = ColorCache.getColor(wCosmetic.emissiveHue ?? "#121212");

        pbrMaterials.forEach((pbrMat) => {
          let matColor = cachedColor;
          let scale = emissive.WEAVER_EMISSIVE_SCALE * 0.42;

          if (pbrMat.name === "weaverEyeMat") {
            if (isYellowTelegraph) {
              matColor = ColorCache.getColor("#dffe00");
              scale = 1.0;
            } else {
              matColor = new BABYLON.Color3(1.0, 0.0, 0.0);
              scale = 1.0;
            }
          } else if (isYellowTelegraph) {
            if (pbrMat.name === "carapaceMat" || pbrMat.name === "legMat") {
              matColor = ColorCache.getColor("#121212");
            }
          }

          if (pbrMat.name === "legMat") {
            scale *= 0.24;
          }

          pbrMat.emissiveColor.set(
            matColor.r * scale + pulse * 0.12,
            matColor.g * scale,
            matColor.b * scale
          );

          if (wAI) {
            const shearPlugin = (
              pbrMat as BABYLON.PBRMaterial & { _shearPlugin?: SilkMaterialPlugin }
            )._shearPlugin;
            if (shearPlugin) {
              shearPlugin.shearIntensity = wAI.damageShearIntensity;
              shearPlugin.shearTime = wAI.damageShearTime;
            }
          }
        });

        let parts = wNode.metadata?.cachedBodyParts as CachedBodyParts | undefined;
        if (!parts) {
          const abdomen = wNode.getChildren(
            (node) => node.name === "weaver_abdomen",
            false
          )[0] as BABYLON.TransformNode;
          const cephalothorax = wNode.getChildren(
            (node) => node.name === "weaver_cephalothorax",
            false
          )[0] as BABYLON.TransformNode;
          const head = wNode.getChildren(
            (node) => node.name === "weaver_head",
            false
          )[0] as BABYLON.TransformNode;

          parts = { abdomen, cephalothorax, head };
          if (!wNode.metadata) {
            wNode.metadata = {};
          }
          wNode.metadata.cachedBodyParts = parts;
        }

        const bodySway = Math.sin(this.visualClock * 4.0) * 0.05 * 0.16;
        const bodyBob = Math.cos(this.visualClock * 8.0) * 1.5 * 0.008;

        this.animateBodyPart(parts.abdomen, bodySway, bodyBob * 0.55, 0.55);
        this.animateBodyPart(parts.cephalothorax, -bodySway * 0.45, bodyBob * 0.35, 0.28);
        this.animateBodyPart(parts.head, -bodySway * 0.7, bodyBob * 0.45, 0.4);
      }
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
