import { RasterShearPlugin } from "../lighting/RasterShearPlugin";
import { VISUAL_JUICE_CONFIG } from "../../core/engine/ArenaConfig";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  TetherComponent,
  TraversalStateComponent,
  WeaverAIComponent
} from "../../core/ecs/Components";
import * as BABYLON from "@babylonjs/core";

export class VisualStateDressingSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;

  public update(dt: number): void {
    const wAI = this.context.stores.get<WeaverAIComponent>("weaverAI").get(this.context.refs.weaver);
    if (wAI) {
      wAI.damageWarpTime += dt;
      if (wAI.damageWarpIntensity > 0.0) {
        wAI.damageWarpIntensity = Math.max(0.0, wAI.damageWarpIntensity - dt * 1.75);
      }
    }
  }

  private currentEmissiveR = 0.05;
  private currentEmissiveG = 0.15;
  private currentEmissiveB = 0.05;
  private colorCache = new Map<string, BABYLON.Color3>();

  constructor(private context: SystemContext) {}

  public render(): void {
    this.updateAestheticDressing();
  }

  private updateAestheticDressing(): void {
    const tether = this.context.stores.get<TetherComponent>("tether").get(this.context.refs.player);
    const trav = this.context.stores.get<TraversalStateComponent>("traversal").get(this.context.refs.player);
    const wAI = this.context.stores.get<WeaverAIComponent>("weaverAI").get(this.context.refs.weaver);
    const emissive = VISUAL_JUICE_CONFIG.EMISSIVE;

    const pNode = this.context.visualRegistry.getTransformNode(this.context.refs.player);
    if (pNode && tether && trav) {
      const mesh = pNode as BABYLON.AbstractMesh;
      const mat = mesh.material as BABYLON.PBRMaterial | null;
      if (mat) {
        this.updatePlayerEmissive(mat, tether.tension, trav.state);
      }
    }

    const wNode = this.context.visualRegistry.getTransformNode(this.context.refs.weaver);
    if (wNode && wAI) {
      const mesh = wNode as BABYLON.AbstractMesh;
      const mat = mesh.material as BABYLON.PBRMaterial | null;
      if (mat) {
        let cachedColor = this.colorCache.get(wAI.hue);
        if (!cachedColor) {
          const hex = wAI.hue.replace(String.fromCharCode(35), "");
          const r = parseInt(hex.substring(0, 2), 16) / 255;
          const g = parseInt(hex.substring(2, 4), 16) / 255;
          const b = parseInt(hex.substring(4, 6), 16) / 255;
          cachedColor = new BABYLON.Color3(r, g, b);
          this.colorCache.set(wAI.hue, cachedColor);
        }
        const pulse = emissive.WEAVER_EMISSIVE_PULSE_BASE + Math.sin(Date.now() * emissive.WEAVER_EMISSIVE_PULSE_FREQ) * emissive.WEAVER_EMISSIVE_PULSE_AMP;
        mat.emissiveColor.set(
          cachedColor.r * emissive.WEAVER_EMISSIVE_SCALE + pulse,
          cachedColor.g * emissive.WEAVER_EMISSIVE_SCALE,
          cachedColor.b * emissive.WEAVER_EMISSIVE_SCALE
        );

        const shearPlugin = (mat as BABYLON.PBRMaterial & { _shearPlugin?: RasterShearPlugin })._shearPlugin;
        if (shearPlugin) {
          shearPlugin.shearIntensity = wAI.damageWarpIntensity;
          shearPlugin.shearTime = wAI.damageWarpTime;
        }
      }
    }
  }

  private updatePlayerEmissive(
    mat: BABYLON.PBRMaterial,
    tension: number,
    state: string
  ): void {
    let targetR: number;
    let targetG: number;
    let targetB: number;

    const emissive = VISUAL_JUICE_CONFIG.EMISSIVE;

    if (state === "WALL_SLIDING") {
      targetR = emissive.PLAYER_EMISSIVE_SLIDE.BASE_R + Math.min(1.0, tension) * emissive.PLAYER_EMISSIVE_SLIDE.RANGE_R;
      targetG = emissive.PLAYER_EMISSIVE_SLIDE.BASE_G + (1.0 - Math.min(1.0, tension)) * emissive.PLAYER_EMISSIVE_SLIDE.RANGE_G;
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
