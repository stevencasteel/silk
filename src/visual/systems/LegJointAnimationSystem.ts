import { ParallaxScrollSystem } from "./ParallaxScrollSystem";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  WallBugComponent,
  WeaverCosmeticComponent,
  KinematicVelocityComponent,
  WeaverAIComponent
} from "../../core/ecs/Components";
import * as BABYLON from "@babylonjs/core";

interface CachedWeaverParts {
  legRoots: BABYLON.TransformNode[];
  legs: Map<string, { coxa: BABYLON.TransformNode; tibia: BABYLON.TransformNode }>;
}

export class LegJointAnimationSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;

  private gaitClock = 0.0;
  private gaitAmp = 0.12;
  private gaitFreq = 8.0;
  private gaitTuck = 0.0;

  private readonly _footLocalTarget = new BABYLON.Vector3();
  private readonly _footWorldTarget = new BABYLON.Vector3();
  private readonly _rootWorldInv = new BABYLON.Matrix();
  private readonly _targetLocal = new BABYLON.Vector3();
  private readonly _ikResult = { coxaZ: 0, tibiaZ: 0 };

  constructor(private context: SystemContext) {}

  public update(dt: number): void {
    const weaverCosmetics = this.context.stores.get<WeaverCosmeticComponent>("weaverCosmetic");
    const velocityStore = this.context.stores.get<KinematicVelocityComponent>("velocity");
    const aiStore = this.context.stores.get<WeaverAIComponent>("weaverAI");

    let firstCosmetic: WeaverCosmeticComponent | undefined;
    for (const [, cosmetic] of weaverCosmetics.entries()) {
      firstCosmetic = cosmetic;
      break;
    }

    if (firstCosmetic) {
      const wVel = velocityStore.get(this.context.refs.weaver);
      const ai = aiStore.get(this.context.refs.weaver);

      const velX = wVel ? wVel.x : 0.0;
      const velY = wVel ? wVel.y : 0.0;
      const scrollSpeed = ParallaxScrollSystem.currentScrollSpeed;

      const relX = velX;
      const relY = velY + scrollSpeed;
      const relativeSpeed = Math.sqrt(relX * relX + relY * relY);

      const TRACTION_RATIO = 0.135;

      let dynamicFreq = 0.0;
      if (firstCosmetic.gaitFrequency > 0.0) {
        dynamicFreq = firstCosmetic.gaitFrequency;
      } else if (firstCosmetic.gaitAmplitude > 0.001) {
        dynamicFreq = (relativeSpeed * TRACTION_RATIO) / firstCosmetic.gaitAmplitude;
      }

      if (ai && ai.state === "DEFEATED") {
        dynamicFreq = 0.0;
      }

      const blend = 1.0 - Math.exp(-dt * 8.0);
      this.gaitAmp += (firstCosmetic.gaitAmplitude - this.gaitAmp) * blend;
      this.gaitFreq += (dynamicFreq - this.gaitFreq) * blend;
      this.gaitTuck += (firstCosmetic.gaitTuck - this.gaitTuck) * blend;
    }

    this.gaitClock = (this.gaitClock + dt * this.gaitFreq) % (Math.PI * 2000.0);
  }

  public render(): void {
    this.dressWeaverLegs();
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
      const node = this.context.visualQuery.getTransformNode(id);
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

  private dressWeaverLegs(): void {
    const weaverCosmetics = this.context.stores.get<WeaverCosmeticComponent>("weaverCosmetic");

    for (const [id] of weaverCosmetics.entries()) {
      const wNode = this.context.visualQuery.getTransformNode(id);
      if (!(wNode instanceof BABYLON.AbstractMesh)) continue;

      const mesh = wNode;
      let parts = mesh.metadata?.cachedParts as CachedWeaverParts | undefined;
      if (!parts) {
        const legRoots = mesh.getChildren(
          (node) => node.name.startsWith("leg_root_"),
          false
        ) as BABYLON.TransformNode[];

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

        parts = { legRoots, legs: legsMap };
        if (!mesh.metadata) {
          mesh.metadata = {};
        }
        mesh.metadata.cachedParts = parts;
      }

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

        // Apply dynamic horizontal stretching/reaching via gaitTuck
        const tuckFactor = 1.0 - this.gaitTuck * 0.35;
        this._footLocalTarget.x *= tuckFactor;

        this._footLocalTarget.x += sweep * 4.4;
        this._footLocalTarget.y += lift * 4.4;

        BABYLON.Vector3.TransformCoordinatesToRef(
          this._footLocalTarget,
          mesh.getWorldMatrix(),
          this._footWorldTarget
        );

        const wallLimit = 15.0;
        const ceilingY = 38.0;
        const floorY = -8.0;

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
}
