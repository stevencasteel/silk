import { ColorCache, solveScaleSpring } from "../../core/utils/EngineUtils";
import { RasterShearPlugin } from "../lighting/RasterShearPlugin";
import { VISUAL_JUICE_CONFIG, ARENA_CONFIG, WEAVER_AI_TUNING } from "../../core/engine/ArenaConfig";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  TetherComponent,
  TraversalStateComponent,
  WeaverAIComponent,
  KinematicVelocityComponent,
  TransformComponent,
  WeaverTraversalComponent,
  WallBugComponent
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

  private currentEmissiveColor = new BABYLON.Color3(0.05, 0.15, 0.05);
  private readonly _targetEmissiveColor = new BABYLON.Color3();

  private visualClock = 0.0;
  private gaitClock = 0.0;
  private gaitAmp = 0.12;
  private gaitFreq = 8.0;
  private gaitTuck = 0.0;

  private readonly _footLocalTarget = new BABYLON.Vector3();
  private readonly _footWorldTarget = new BABYLON.Vector3();
  private readonly _rootWorldInv = new BABYLON.Matrix();
  private readonly _targetLocal = new BABYLON.Vector3();
  private readonly _ikResult = { coxaZ: 0, tibiaZ: 0 };

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

      const target = this.resolveWeaverGaitTargets(wAI);
      const blend = 1.0 - Math.exp(-dt * 8.0);
      this.gaitAmp += (target.amp - this.gaitAmp) * blend;
      this.gaitFreq += (target.freq - this.gaitFreq) * blend;
      this.gaitTuck += (target.tuck - this.gaitTuck) * blend;
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

    this.gaitClock = (this.gaitClock + dt * this.gaitFreq) % (Math.PI * 2000.0);
  }

  public render(): void {
    this.updateAestheticDressing();
    this.dressWallBugLegs();
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

    if (sideSign > 0) {
      this._ikResult.coxaZ = angleTargetLocalY + beta;
      this._ikResult.tibiaZ = -(Math.PI - gamma);
    } else {
      this._ikResult.coxaZ = angleTargetLocalY - beta;
      this._ikResult.tibiaZ = Math.PI - gamma;
    }

    return this._ikResult;
  }

  private dressWallBugLegs(): void {
    const bugStore = this.context.stores.get<WallBugComponent>("wallBug");
    for (const [id, bug] of bugStore.entries()) {
      const node = this.context.visualRegistry.getTransformNode(id);
      if (!node) continue;

      const bugPhase = bug.gaitPhase;
      node.getChildren().forEach((child) => {
        if (child.name.startsWith("leg_joint_left")) {
          const index = parseInt(child.name.substring(child.name.lastIndexOf("_") + 1));
          const childTrans = child as BABYLON.TransformNode;
          childTrans.rotation.z = Math.sin(bugPhase + index * 1.5) * 0.22;

          childTrans.getChildren().forEach((subChild) => {
            if (subChild.name.startsWith("tibia_joint_left")) {
              const subTrans = subChild as BABYLON.TransformNode;
              subTrans.rotation.z = Math.PI / 4 + Math.cos(bugPhase + index * 1.5) * 0.32;
            }
          });
        } else if (child.name.startsWith("leg_joint_right")) {
          const index = parseInt(child.name.substring(child.name.lastIndexOf("_") + 1));
          const childTrans = child as BABYLON.TransformNode;
          childTrans.rotation.z = -Math.sin(bugPhase + index * 1.5) * 0.22;

          childTrans.getChildren().forEach((subChild) => {
            if (subChild.name.startsWith("tibia_joint_right")) {
              const subTrans = subChild as BABYLON.TransformNode;
              subTrans.rotation.z = -Math.PI / 4 - Math.cos(bugPhase + index * 1.5) * 0.32;
            }
          });
        }
      });
    }
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

      let parts = mesh.metadata?.cachedParts as CachedWeaverParts | undefined;
      if (!parts) {
        const legRoots = mesh.getChildren(
          (node) => node.name.startsWith("leg_root_"),
          false
        ) as BABYLON.TransformNode[];
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

        const legsMap = new Map<
          string,
          { coxa: BABYLON.TransformNode; tibia: BABYLON.TransformNode }
        >();
        legRoots.forEach((root) => {
          const coxa = root
            .getChildren()
            .find((c) => c.name.startsWith("coxa_")) as BABYLON.TransformNode;
          if (coxa) {
            const tibia = coxa
              .getChildren()
              .find((c) => c.name.startsWith("tibia_")) as BABYLON.TransformNode;
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

        const rootMeta = transNode.metadata as {
          sideSign: number;
          index: number;
          baseRootZ?: number;
          basePositionZ?: number;
          coxaLength?: number;
          tibiaLength?: number;
          baseFootLocal?: BABYLON.Vector3;
        } | null;

        if (!rootMeta) return;

        const sideSign = rootMeta.sideSign;
        const index = rootMeta.index;
        const legJoints = parts?.legs.get(transNode.name);

        if (
          rootMeta.coxaLength === undefined ||
          rootMeta.tibiaLength === undefined ||
          !rootMeta.baseFootLocal ||
          !legJoints
        ) {
          const baseRootZ = rootMeta.baseRootZ ?? 0;
          const diagonalOffset = (index + (sideSign > 0 ? 0 : 1)) % 2 === 0 ? 0 : Math.PI;
          const rowOffset = index * 0.18;
          const phase = this.gaitClock + diagonalOffset + rowOffset;

          const sweep = Math.sin(phase) * this.gaitAmp * (1.0 - Math.abs(this.gaitTuck) * 0.25);
          const liftWave = (1.0 - Math.cos(phase)) * 0.5;
          const lift = liftWave * this.gaitAmp;

          transNode.rotation.z = baseRootZ + sideSign * sweep;
          transNode.rotation.y = 0;
          transNode.position.z = rootMeta.basePositionZ ?? transNode.position.z;

          const coxa = legJoints?.coxa;
          if (coxa) {
            const coxaMeta = coxa.metadata as {
              baseRotationZ?: number;
              baseRotationX?: number;
            } | null;
            const baseCoxaZ = coxaMeta?.baseRotationZ ?? coxa.rotation.z;
            const baseCoxaX = coxaMeta?.baseRotationX ?? coxa.rotation.x;

            const coxaTuckAngle = sideSign * this.gaitTuck * 0.24;
            const coxaLift = sideSign * lift * 0.16;
            coxa.rotation.z = baseCoxaZ + coxaTuckAngle + coxaLift;
            coxa.rotation.x = baseCoxaX;

            const tibia = legJoints?.tibia;
            if (tibia) {
              const tibiaMeta = tibia.metadata as {
                baseRotationZ?: number;
                baseRotationX?: number;
              } | null;
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

        BABYLON.Vector3.TransformCoordinatesToRef(
          this._footLocalTarget,
          mesh.getWorldMatrix(),
          this._footWorldTarget
        );

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
        BABYLON.Vector3.TransformCoordinatesToRef(
          this._footWorldTarget,
          this._rootWorldInv,
          this._targetLocal
        );

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

  private resolveWeaverGaitTargets(wAI: WeaverAIComponent): {
    amp: number;
    freq: number;
    tuck: number;
  } {
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
