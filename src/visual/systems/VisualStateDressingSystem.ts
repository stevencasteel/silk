import { ColorCache, solveScaleSpring } from "../../core/utils/EngineUtils";
import { RasterShearPlugin } from "../lighting/RasterShearPlugin";
import { VISUAL_JUICE_CONFIG, WEAVER_AI_TUNING } from "../../core/engine/ArenaConfig";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  TetherComponent,
  TraversalStateComponent,
  WeaverAIComponent,
  KinematicVelocityComponent,
  TransformComponent,
  WeaverTraversalComponent
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
    const wTrav = this.context.stores
      .get<WeaverTraversalComponent>("weaverTraversal")
      .get(this.context.refs.weaver);
    const velStore = this.context.stores.get<KinematicVelocityComponent>("velocity");
    const wVel = velStore.get(this.context.refs.weaver);

    if (wAI) {
      wAI.damageShearTime += dt;
      if (wAI.damageShearIntensity > 0.0) {
        wAI.damageShearIntensity = Math.max(0.0, wAI.damageShearIntensity - dt * 1.75);
      }
    }

    if (wTrans && wAI && wTrav && wVel) {
      wTrans.prevScaleX = wTrans.scaleX!;
      wTrans.prevScaleY = wTrans.scaleY!;
      wTrans.prevScaleZ = wTrans.scaleZ!;

      let targetScaleX = 1.0;
      let targetScaleY = 1.0;
      let targetScaleZ = 1.0;

      this._weaverTargetQuat.set(0, 0, 0, 1);

      if (wAI.state === "DEFEATED") {
        targetScaleX = WEAVER_AI_TUNING.DEFEATED.SCALE;
        targetScaleY = WEAVER_AI_TUNING.DEFEATED.SCALE;
        targetScaleZ = WEAVER_AI_TUNING.DEFEATED.SCALE;
        BABYLON.Quaternion.RotationYawPitchRollToRef(0, 0, 0, this._weaverTargetQuat);
      } else if (wTrav.isWallClinging) {
        const breath = wAI.state === "PATROLLING" ? Math.sin(wAI.timeInState * 10.0) * 0.015 : 0.0;
        targetScaleX = 0.75 + breath;
        targetScaleY = 1.15 - breath * 0.5;
        targetScaleZ = 1.15 - breath * 0.5;
        BABYLON.Quaternion.RotationYawPitchRollToRef(0, 0, 0, this._weaverTargetQuat);
      } else if (wTrav.isGrounded) {
        targetScaleY = 0.75;
        targetScaleX = 1.15;
        targetScaleZ = 1.15;
        BABYLON.Quaternion.RotationYawPitchRollToRef(0, 0, 0, this._weaverTargetQuat);
      } else {
        if (wAI.state === "PATROLLING") {
          const pulse =
            Math.sin(wAI.timeInState * WEAVER_AI_TUNING.ANIMATION.PULSE_FREQ) *
            WEAVER_AI_TUNING.ANIMATION.PULSE_BASE;
          targetScaleX = 1.0 + pulse;
          targetScaleY = 1.0 - pulse;

          const rollAngle = -wVel.x * WEAVER_AI_TUNING.ANIMATION.ROLL_ANGLE_SCALE;
          const MathAngle =
            Math.sin(wAI.timeInState * WEAVER_AI_TUNING.ANIMATION.YAW_PITCH_ROLL_FREQ) *
            WEAVER_AI_TUNING.ANIMATION.YAW_PITCH_ROLL_AMP;
          BABYLON.Quaternion.RotationYawPitchRollToRef(MathAngle, 0, rollAngle, this._weaverTargetQuat);
        } else if (wAI.state === "STRIKING") {
          const speed = Math.sqrt(wVel.x * wVel.x + wVel.y * wVel.y);
          if (speed < WEAVER_AI_TUNING.DASH.SPEED_THRESHOLD) {
            targetScaleY = WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.PREP_Y;
            targetScaleX = WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.PREP_X;
            targetScaleZ = WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.PREP_Z;

            const wobbleFreq = 12.0;
            const wobbleAmp =
              0.08 * Math.max(0.0, 1.0 - wAI.timeInState / WEAVER_AI_TUNING.DASH.PREP_TIME);
            const wobbleAngle = Math.sin(wAI.timeInState * wobbleFreq) * Math.max(0.02, wobbleAmp);
            BABYLON.Quaternion.RotationYawPitchRollToRef(0, 0, wobbleAngle, this._weaverTargetQuat);
          } else {
            const stretch = Math.min(
              WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.STRETCH_MAX,
              (speed / WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.STRETCH_SPEED_BASIS) *
                WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.STRETCH_MAX
            );
            targetScaleY = 1.0 + stretch;
            targetScaleX = 1.0 - stretch * 0.5;
            targetScaleZ = 1.0 - stretch * 0.5;

            const angle = Math.atan2(wVel.y, wVel.x) + Math.PI / 2;
            BABYLON.Quaternion.RotationAxisToRef(BABYLON.Axis.Z, angle, this._weaverTargetQuat);
          }
        } else if (wAI.state === "ASCENDING") {
          targetScaleY = WEAVER_AI_TUNING.RETURN.SQUASH_STRETCH.Y;
          targetScaleX = WEAVER_AI_TUNING.RETURN.SQUASH_STRETCH.X;
          BABYLON.Quaternion.RotationYawPitchRollToRef(0, 0, 0, this._weaverTargetQuat);
        }
      }

      solveScaleSpring(wTrans, targetScaleX, targetScaleY, targetScaleZ, dt, 120, 22);

      this._weaverCurrentQuat.set(wTrans.qx, wTrans.qy, wTrans.qz, wTrans.qw);
      BABYLON.Quaternion.SlerpToRef(
        this._weaverCurrentQuat,
        this._weaverTargetQuat,
        WEAVER_AI_TUNING.ANIMATION.LERP_RATE * dt,
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
    const emissive = VISUAL_JUICE_CONFIG.EMISSIVE;

    const pNode = this.context.visualRegistry.getTransformNode(this.context.refs.player);
    if (pNode && tether && trav) {
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

    this._targetEmissiveColor.set(targetR, targetG, targetB);
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
  }
}
