import { ColorCache } from "../../core/utils/EngineUtils";
import { RasterShearPlugin } from "../lighting/RasterShearPlugin";
import { VISUAL_JUICE_CONFIG, ARENA_CONFIG } from "../../core/engine/ArenaConfig";
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

interface CachedWeaverParts {
  legRoots: BABYLON.TransformNode[];
  abdomen: BABYLON.TransformNode;
  cephalothorax: BABYLON.TransformNode;
  head: BABYLON.TransformNode;
  legs: Map<string, { coxa: BABYLON.TransformNode; tibia: BABYLON.TransformNode }>;
}

export class VisualStateDressingSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;

  private currentEmissiveR = 0.05;
  private currentEmissiveG = 0.15;
  private currentEmissiveB = 0.05;
  private visualClock = 0.0;
  private gaitClock = 0.0;
  private gaitAmp = 0.12;
  private gaitFreq = 8.0;
  private gaitTuck = 0.0;

  // Reusable scratch objects to completely prevent dynamic GC allocations in rendering loops
  private readonly _footLocalTarget = new BABYLON.Vector3();
  private readonly _footWorldTarget = new BABYLON.Vector3();
  private readonly _rootWorldInv = new BABYLON.Matrix();
  private readonly _targetLocal = new BABYLON.Vector3();

  constructor(private context: SystemContext) {}

  public update(dt: number): void {
    this.visualClock += dt;

    const wAI = this.context.stores
      .get<WeaverAIComponent>("weaverAI")
      .get(this.context.refs.weaver);
    if (wAI) {
      wAI.damageShearTime += dt;
      if (wAI.damageShearIntensity > 0.0) {
        wAI.damageShearIntensity = Math.max(0.0, wAI.damageShearIntensity - dt * 1.75);
      }

      const target = this.resolveWeaverGaitTargets(wAI);
      const blend = 1.0 - Math.exp(-dt * 8.0);
      this.gaitAmp += (target.amp - this.gaitAmp) * blend;
      this.gaitFreq += (target.freq - this.gaitFreq) * blend;
      this.gaitTuck += (target.tuck - this.gaitTuck) * blend;
    }

    this.gaitClock = (this.gaitClock + dt * this.gaitFreq) % (Math.PI * 2000.0);
  }

  public render(): void {
    this.updateAestheticDressing();
  }

  private solveIK(
    target: BABYLON.Vector3,
    L1: number,
    L2: number,
    sideSign: number
  ): { coxaZ: number; tibiaZ: number } {
    const x = target.x;
    const y = target.y;
    const d = Math.sqrt(x * x + y * y);

    const minD = Math.abs(L1 - L2) + 0.01;
    const maxD = L1 + L2 - 0.01;
    const dist = Math.max(minD, Math.min(maxD, d));

    const angleTargetLocalY = Math.atan2(-x, y);

    const cosBeta = (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist);
    const beta = Math.acos(Math.max(-1, Math.min(1, cosBeta)));

    const cosGamma = (L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2);
    const gamma = Math.acos(Math.max(-1, Math.min(1, cosGamma)));

    let coxaZ: number;
    let tibiaZ: number;

    if (sideSign > 0) {
      coxaZ = angleTargetLocalY + beta;
      tibiaZ = -(Math.PI - gamma);
    } else {
      coxaZ = angleTargetLocalY - beta;
      tibiaZ = Math.PI - gamma;
    }

    return { coxaZ, tibiaZ };
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
        Math.sin(this.visualClock * 5.5) * emissive.WEAVER_EMISSIVE_PULSE_AMP;

      const cachedColor = ColorCache.getColor(wAI.hue);

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

      // Query cache implementation - dynamically resolves and caches parts once to prevent high-frequency getChildren array allocations
      let parts = mesh.metadata?.cachedParts as CachedWeaverParts | undefined;
      if (!parts) {
        const legRoots = mesh.getChildren((node) => node.name.startsWith("leg_root_"), false) as BABYLON.TransformNode[];
        const abdomen = mesh.getChildren((node) => node.name === "weaver_abdomen", false)[0] as BABYLON.TransformNode;
        const cephalothorax = mesh.getChildren((node) => node.name === "weaver_cephalothorax", false)[0] as BABYLON.TransformNode;
        const head = mesh.getChildren((node) => node.name === "weaver_head", false)[0] as BABYLON.TransformNode;
        
        const legsMap = new Map<string, { coxa: BABYLON.TransformNode; tibia: BABYLON.TransformNode }>();
        legRoots.forEach((root) => {
          const coxa = root.getChildren().find((c) => c.name.startsWith("coxa_")) as BABYLON.TransformNode;
          if (coxa) {
            const tibia = coxa.getChildren().find((c) => c.name.startsWith("tibia_")) as BABYLON.TransformNode;
            if (tibia) {
              legsMap.set(root.name, { coxa, tibia });
            }
          }
        });

        parts = { legRoots, abdomen, cephalothorax, head, legs: legsMap };
        if (!mesh.metadata) {
          mesh.metadata = {};
        }
        mesh.metadata.cachedParts = parts;
      }

      const bodySway = Math.sin(this.gaitClock * 0.5) * this.gaitAmp * 0.16;
      const bodyBob = Math.cos(this.gaitClock) * 1.5 * 0.008;

      this.animateBodyPart(parts.abdomen, bodySway, bodyBob * 0.55, 0.55);
      this.animateBodyPart(parts.cephalothorax, -bodySway * 0.45, bodyBob * 0.35, 0.28);
      this.animateBodyPart(parts.head, -bodySway * 0.7, bodyBob * 0.45, 0.4);

      parts.legRoots.forEach((node) => {
        const transNode = node as BABYLON.TransformNode;
        const partsName = transNode.name.split("_");
        const sideSign = parseFloat(partsName[2]);
        const index = parseFloat(partsName[3]);

        if (isNaN(sideSign) || isNaN(index)) return;

        const rootMeta = transNode.metadata as {
          sideSign?: number;
          index?: number;
          baseRootZ?: number;
          basePositionZ?: number;
          coxaLength?: number;
          tibiaLength?: number;
          baseFootLocal?: BABYLON.Vector3;
        } | null;

        const legJoints = parts?.legs.get(transNode.name);

        if (
          !rootMeta ||
          rootMeta.coxaLength === undefined ||
          rootMeta.tibiaLength === undefined ||
          !rootMeta.baseFootLocal ||
          !legJoints
        ) {
          const baseRootZ = rootMeta?.baseRootZ ?? 0;
          const diagonalOffset = (index + (sideSign > 0 ? 0 : 1)) % 2 === 0 ? 0 : Math.PI;
          const rowOffset = index * 0.18;
          const phase = this.gaitClock + diagonalOffset + rowOffset;

          const sweep = Math.sin(phase) * this.gaitAmp * (1.0 - Math.abs(this.gaitTuck) * 0.25);
          const liftWave = (1.0 - Math.cos(phase)) * 0.5;
          const lift = liftWave * this.gaitAmp;

          transNode.rotation.z = baseRootZ + sideSign * sweep;
          transNode.rotation.y = 0;
          transNode.position.z = rootMeta?.basePositionZ ?? transNode.position.z;

          const coxa = legJoints?.coxa;
          if (coxa) {
            const coxaMeta = coxa.metadata as { baseRotationZ?: number; baseRotationX?: number } | null;
            const baseCoxaZ = coxaMeta?.baseRotationZ ?? coxa.rotation.z;
            const baseCoxaX = coxaMeta?.baseRotationX ?? coxa.rotation.x;
            
            const coxaTuckAngle = sideSign * this.gaitTuck * 0.24;
            const coxaLift = sideSign * lift * 0.16;
            coxa.rotation.z = baseCoxaZ + coxaTuckAngle + coxaLift;
            coxa.rotation.x = baseCoxaX;

            const tibia = legJoints?.tibia;
            if (tibia) {
              const tibiaMeta = tibia.metadata as { baseRotationZ?: number; baseRotationX?: number } | null;
              const baseTibiaZ = tibiaMeta?.baseRotationZ ?? tibia.rotation.z;
              const baseTibiaX = tibiaMeta?.baseRotationX ?? tibia.rotation.x;
              
              const tibiaTuckAngle = -sideSign * this.gaitTuck * 0.34;
              const tibiaSweep = -sideSign * (sweep * 0.12 + lift * 0.1);
              tibia.rotation.z = baseTibiaZ + tibiaTuckAngle + tibiaSweep;
              tibia.rotation.x = baseTibiaX;
            }
          }
          return;
        }

        const coxaLength = rootMeta.coxaLength;
        const tibiaLength = rootMeta.tibiaLength;
        const baseFootLocal = rootMeta.baseFootLocal;

        const diagonalOffset = (index + (sideSign > 0 ? 0 : 1)) % 2 === 0 ? 0 : Math.PI;
        const rowOffset = index * 0.18;
        const phase = this.gaitClock + diagonalOffset + rowOffset;

        const sweep = Math.sin(phase) * this.gaitAmp * 1.5;
        const liftWave = (1.0 - Math.cos(phase)) * 0.5;
        const lift = liftWave * this.gaitAmp * 1.2;

        this._footLocalTarget.copyFrom(baseFootLocal);
        this._footLocalTarget.x += sweep * ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
        this._footLocalTarget.y += lift * ARENA_CONFIG.ENTITY.WEAVER_RADIUS;

        BABYLON.Vector3.TransformCoordinatesToRef(this._footLocalTarget, mesh.getWorldMatrix(), this._footWorldTarget);

        const wallLimit = ARENA_CONFIG.HORIZONTAL.PLAY_AREA_HALF_WIDTH;
        const ceilingY = ARENA_CONFIG.VERTICAL.CEILING_Y;
        const floorY = ARENA_CONFIG.VERTICAL.FLOOR_Y;

        const checkMargin = 0.55; 
        if (this._footWorldTarget.x > wallLimit - checkMargin) {
          this._footWorldTarget.x = wallLimit;
        } else if (this._footWorldTarget.x < -wallLimit + checkMargin) {
          this._footWorldTarget.x = -wallLimit;
        }

        if (this._footWorldTarget.y > ceilingY - checkMargin) {
          this._footWorldTarget.y = ceilingY;
        } else if (this._footWorldTarget.y < floorY + checkMargin) {
          this._footWorldTarget.y = floorY;
        }

        transNode.getWorldMatrix().invertToRef(this._rootWorldInv);
        BABYLON.Vector3.TransformCoordinatesToRef(this._footWorldTarget, this._rootWorldInv, this._targetLocal);

        const ikRotations = this.solveIK(this._targetLocal, coxaLength, tibiaLength, sideSign);

        transNode.rotation.z = 0; 
        transNode.rotation.y = 0;
        transNode.position.z = rootMeta.basePositionZ ?? transNode.position.z;

        const coxa = legJoints.coxa;
        if (coxa) {
          const coxaMeta = coxa.metadata as { baseRotationX?: number } | null;
          const baseCoxaX = coxaMeta?.baseRotationX ?? coxa.rotation.x;
          coxa.rotation.z = ikRotations.coxaZ;
          coxa.rotation.x = baseCoxaX;

          const tibia = legJoints.tibia;
          if (tibia) {
            const tibiaMeta = tibia.metadata as { baseRotationX?: number } | null;
            const baseTibiaX = tibiaMeta?.baseRotationX ?? tibia.rotation.x;
            tibia.rotation.z = ikRotations.tibiaZ;
            tibia.rotation.x = baseTibiaX;
          }
        }
      });
    }
  }

  private resolveWeaverGaitTargets(wAI: WeaverAIComponent): { amp: number; freq: number; tuck: number } {
    if (wAI.state === "STRIKING" || wAI.state.includes("WEAVER STRIKE")) {
      const velStore = this.context.stores.get<KinematicVelocityComponent>("velocity");
      const wVel = velStore.get(this.context.refs.weaver);
      const speed = wVel ? Math.sqrt(wVel.x * wVel.x + wVel.y * wVel.y) : 0;

      if (speed < 0.1) {
        return { amp: 0.035, freq: 13.0, tuck: 0.72 };
      }
      return { amp: 0.055, freq: 8.5, tuck: -0.42 };
    }

    if (wAI.state === "PATROLLING" || wAI.state.includes("PATROLLING")) {
      const velStore = this.context.stores.get<KinematicVelocityComponent>("velocity");
      const wVel = velStore.get(this.context.refs.weaver);
      const speed = wVel ? Math.abs(wVel.x) : 4.5;
      const speedScale = Math.min(1.45, Math.max(0.45, speed / 4.5));
      return { amp: 0.13 * speedScale, freq: 7.2 + speed * 0.75, tuck: 0.0 };
    }

    if (wAI.state === "ASCENDING" || wAI.state.includes("ASCENDING")) {
      return { amp: 0.055, freq: 7.5, tuck: 0.28 };
    }

    if (wAI.state === "DEFEATED" || wAI.state.includes("DEFEATED")) {
      return { amp: 0.0, freq: 5.0, tuck: 0.82 };
    }

    return { amp: 0.09, freq: 7.5, tuck: 0.12 };
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
