import { RasterShearPlugin } from "../lighting/RasterShearPlugin";
import { VISUAL_JUICE_CONFIG } from "../../core/engine/ArenaConfig";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  TetherComponent,
  TraversalStateComponent,
  WeaverAIComponent,
  KinematicVelocityComponent
} from "../../core/ecs/Components";
import * as BABYLON from "@babylonjs/core";

export class VisualStateDressingSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;

  private currentEmissiveR = 0.05;
  private currentEmissiveG = 0.15;
  private currentEmissiveB = 0.05;
  private colorCache = new Map<string, BABYLON.Color3>();

  constructor(private context: SystemContext) {}

  public update(dt: number): void {
    const wAI = this.context.stores
      .get<WeaverAIComponent>("weaverAI")
      .get(this.context.refs.weaver);
    if (wAI) {
      wAI.damageShearTime += dt;
      if (wAI.damageShearIntensity > 0.0) {
        wAI.damageShearIntensity = Math.max(0.0, wAI.damageShearIntensity - dt * 1.75);
      }
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
    const emissive = VISUAL_JUICE_CONFIG.EMISSIVE;

    const pNode = this.context.visualRegistry.getTransformNode(this.context.refs.player);
    if (pNode && tether && trav) {
      const mesh = pNode as BABYLON.AbstractMesh;
      
      const pbrMaterials: BABYLON.PBRMaterial[] = [];
      if (mesh.material instanceof BABYLON.PBRMaterial) {
        pbrMaterials.push(mesh.material);
      }
      mesh.getChildMeshes().forEach((child) => {
        if (child.material instanceof BABYLON.PBRMaterial && !pbrMaterials.includes(child.material)) {
          pbrMaterials.push(child.material);
        }
      });

      pbrMaterials.forEach((mat) => {
        this.updatePlayerEmissive(mat, tether.tension, trav.state);
      });
    }

    const wNode = this.context.visualRegistry.getTransformNode(this.context.refs.weaver);
    if (wNode && wAI) {
      const mesh = wNode as BABYLON.AbstractMesh;

      const pbrMaterials: BABYLON.PBRMaterial[] = [];
      if (mesh.material instanceof BABYLON.PBRMaterial) {
        pbrMaterials.push(mesh.material);
      }
      mesh.getChildMeshes().forEach((child) => {
        if (child.material instanceof BABYLON.PBRMaterial && !pbrMaterials.includes(child.material)) {
          pbrMaterials.push(child.material);
        }
      });

      const pulse =
        emissive.WEAVER_EMISSIVE_PULSE_BASE +
        Math.sin(Date.now() * emissive.WEAVER_EMISSIVE_PULSE_FREQ) *
          emissive.WEAVER_EMISSIVE_PULSE_AMP;

      let cachedColor = this.colorCache.get(wAI.hue);
      if (!cachedColor) {
        const hex = wAI.hue.replace(String.fromCharCode(35), "");
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;
        cachedColor = new BABYLON.Color3(r, g, b);
        this.colorCache.set(wAI.hue, cachedColor);
      }

      pbrMaterials.forEach((pbrMat) => {
        let scale = emissive.WEAVER_EMISSIVE_SCALE;
        if (pbrMat.name === "legMat") {
          scale *= 0.15;
        }

        pbrMat.emissiveColor.set(
          cachedColor!.r * scale + pulse * 0.2,
          cachedColor!.g * scale,
          cachedColor!.b * scale
        );

        const shearPlugin = (pbrMat as BABYLON.PBRMaterial & { _shearPlugin?: RasterShearPlugin })
          ._shearPlugin;
        if (shearPlugin) {
          shearPlugin.shearIntensity = wAI.damageShearIntensity;
          shearPlugin.shearTime = wAI.damageShearTime;
        }
      });

      const timeSec = Date.now() * 0.001;
      const legRoots = mesh.getChildren((node) => node.name.startsWith("leg_root_"), false);

      let tuckFactor = 0.0;
      let swayAmp = 0.15;
      let swayFreq = 12.0;

      if (wAI.state === "STRIKING" || wAI.state.includes("WEAVER STRIKE")) {
        const velStore = this.context.stores.get<KinematicVelocityComponent>("velocity");
        const wVel = velStore.get(this.context.refs.weaver);
        const speed = wVel ? Math.sqrt(wVel.x * wVel.x + wVel.y * wVel.y) : 0;

        if (speed < 0.1) {
          tuckFactor = 0.75;
          swayAmp = 0.04;
          swayFreq = 24.0;
        } else {
          tuckFactor = -0.6;
          swayAmp = 0.05;
          swayFreq = 8.0;
        }
      } else if (wAI.state === "PATROLLING" || wAI.state.includes("PATROLLING")) {
        tuckFactor = 0.0;
        const velStore = this.context.stores.get<KinematicVelocityComponent>("velocity");
        const wVel = velStore.get(this.context.refs.weaver);
        const speed = wVel ? Math.abs(wVel.x) : 4.5;
        swayAmp = 0.18 * (speed / 4.5);
        swayFreq = 8.0 + speed * 1.2;
      } else if (wAI.state === "ASCENDING" || wAI.state.includes("ASCENDING")) {
        tuckFactor = 0.3;
        swayAmp = 0.06;
        swayFreq = 10.0;
      } else if (wAI.state === "DEFEATED" || wAI.state.includes("DEFEATED")) {
        tuckFactor = 0.9;
        swayAmp = 0.0;
      }

      legRoots.forEach((node) => {
        const transNode = node as BABYLON.TransformNode;
        const parts = transNode.name.split("_");
        const sideSign = parseFloat(parts[2]);
        const index = parseFloat(parts[3]);

        if (isNaN(sideSign) || isNaN(index)) return;

        const baseAngle = (index - 1.5) * 0.35;
        const legPhase = timeSec * swayFreq + index * 1.5;
        const sway = Math.sin(legPhase) * swayAmp;

        transNode.rotation.y = baseAngle + sway * 0.4;

        const coxa = transNode.getChildren()[0] as BABYLON.TransformNode | undefined;
        if (coxa) {
          const baseCoxaZ = sideSign * (Math.PI / 4 + baseAngle * 0.3);
          const coxaTuckAngle = sideSign * tuckFactor * (Math.PI / 6);
          coxa.rotation.z = baseCoxaZ + coxaTuckAngle + sideSign * sway * 0.3;

          const tibia = coxa.getChildren()[0] as BABYLON.TransformNode | undefined;
          if (tibia) {
            const baseTibiaZ = -sideSign * (Math.PI / 3);
            const tibiaTuckAngle = -sideSign * tuckFactor * (Math.PI / 4);
            tibia.rotation.z = baseTibiaZ + tibiaTuckAngle + -sideSign * sway * 0.2;
          }
        }
      });
    }
  }

  private updatePlayerEmissive(mat: BABYLON.PBRMaterial, tension: number, state: string): void {
    let targetR: number;
    let targetG: number;
    let targetB: number;

    const emissive = VISUAL_JUICE_CONFIG.EMISSIVE;

    if (state === "WALL_SLIDING") {
      targetR =
        emissive.PLAYER_EMISSIVE_SLIDE.BASE_R +
        Math.min(1.0, tension) * emissive.PLAYER_EMISSIVE_SLIDE.RANGE_R;
      targetG =
        emissive.PLAYER_EMISSIVE_SLIDE.BASE_G +
        (1.0 - Math.min(1.0, tension)) * emissive.PLAYER_EMISSIVE_SLIDE.RANGE_G;
      targetB = (1.0 - Math.min(1.0, tension)) * emissive.PLAYER_EMISSIVE_SLIDE.MULT_B;
    } else if (state === "LAUNCHING") {
      targetR = emissive.PLAYER_EMISSIVE_LAUNCH.R;
      targetG = emissive.PLAYER_EMISSIVE_LAUNCH.G;
      targetB = emissive.PLAYER_EMISSIVE_LAUNCH.B;
    } else {
      targetR = emissive.PLAYER_EMISSIVE_DEFAULT.R;
      targetG = emissive.PLAYER_EMISSIVE_DEFAULT.G;
      targetB = emissive.PLAYER_EMISSIVE_DEFAULT.B;
    }

    const lerpRate = emissive.PLAYER_LERP_RATE;
    this.currentEmissiveR += (targetR - this.currentEmissiveR) * lerpRate;
    this.currentEmissiveG += (targetG - this.currentEmissiveG) * lerpRate;
    this.currentEmissiveB += (targetB - this.currentEmissiveB) * lerpRate;

    mat.emissiveColor.set(
      this.currentEmissiveR * emissive.PLAYER_EMISSIVE_SCALE,
      this.currentEmissiveG * emissive.PLAYER_EMISSIVE_SCALE,
      this.currentEmissiveB * emissive.PLAYER_EMISSIVE_SCALE
    );
  }
}
