import { ISystem } from "../../contracts/ISystem";
import { SubscriptionTracker } from "../../core/utils/EngineUtils";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  TransformComponent,
  WallBugComponent,
  StickySurfaceComponent,
  ProjectileComponent
} from "../../core/ecs/Components";
import { ParallaxScrollSystem } from "../../visual/systems/ParallaxScrollSystem";
import { POST_PROCESSING_PRESETS } from "../../core/engine/ArenaConfig";
import { GameEvent } from "../../core/events/GameEvents";
import { WallBugVisualFactory } from "../../visual/mesh/WallBugVisualFactory";
import * as BABYLON from "@babylonjs/core";

interface PooledBug {
  entityId: number;
  rootNode: BABYLON.TransformNode;
  active: boolean;
}

export class WallBugSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;
  readonly initPhase = InitPhase.Gameplay;

  private spawnTimer = 0.0;
  private readonly spawnInterval = 3.2;
  private bugMaterial: BABYLON.PBRMaterial | null = null;
  private eyeMaterial: BABYLON.StandardMaterial | null = null;
  private _tracker = new SubscriptionTracker();

  private bugPool: PooledBug[] = [];
  private readonly POOL_SIZE = 2;

  private laneBag: number[] = [];
  private readonly LANES = [-5.0, -3.0, -1.0, 0.0, 1.0, 3.0, 5.0];
  private lastSelectedLaneIndex = -1;

  constructor(private context: SystemContext) {}

  public init(): void {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return;

    // Overhaul: Dark metallic slate-grey carapace (Zero yellow/orange emissive body glow!)
    this.bugMaterial = new BABYLON.PBRMaterial("wallBugCarapace", scene);
    this.bugMaterial.metallic = 0.88;
    this.bugMaterial.roughness = 0.24;
    this.bugMaterial.albedoColor = new BABYLON.Color3(0.08, 0.09, 0.12);
    this.bugMaterial.emissiveColor = new BABYLON.Color3(0.0, 0.0, 0.0);
    this.bugMaterial.emissiveIntensity = 0.0;

    // Subtle glowing orange sensory eyes
    this.eyeMaterial = new BABYLON.StandardMaterial("wallBugEyes", scene);
    this.eyeMaterial.emissiveColor = new BABYLON.Color3(0.95, 0.35, 0.0);
    this.eyeMaterial.disableLighting = true;

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const bugId = this.context.world.create();
      const bugRoot = WallBugVisualFactory.buildBugMeshHierarchy(
        bugId,
        scene,
        this.bugMaterial,
        this.eyeMaterial
      );
      bugRoot.setEnabled(false);
      bugRoot.position.set(0, -999, 0);

      this.context.visualRegistration.registerTransformNode(bugId, bugRoot);

      this.bugPool.push({
        entityId: bugId,
        rootNode: bugRoot,
        active: false
      });
    }

    this.spawnTimer = 0.0;

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.clearAllBugs();
        this.spawnTimer = 0.0;
        this.laneBag = [];
        this.lastSelectedLaneIndex = -1;
      })
    );
  }

  public update(dt: number): void {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return;

    this.spawnTimer += dt;
    const activeCount = this.bugPool.filter((p) => p.active).length;

    if (this.spawnTimer >= this.spawnInterval && activeCount < this.POOL_SIZE) {
      this.spawnTimer = 0.0;
      this.spawnBugFromPool();
    }

    const cameraY = scene.activeCamera
      ? scene.activeCamera.position.y
      : POST_PROCESSING_PRESETS.CAMERA.DEFAULT_TARGET.y;
    const currentScrollSpeed = ParallaxScrollSystem.currentScrollSpeed;
    const transformStore = this.context.stores.get<TransformComponent>("transform");
    const bugStore = this.context.stores.get<WallBugComponent>("wallBug");

    for (let i = 0; i < this.bugPool.length; i++) {
      const pBug = this.bugPool[i];
      if (!pBug.active) continue;

      const bug = bugStore.get(pBug.entityId);
      const trans = transformStore.get(pBug.entityId);
      if (!bug || !trans) continue;

      const extraCrawlSpeed = 3.42;
      bug.y -= (currentScrollSpeed + extraCrawlSpeed) * dt;

      if (bug.y < cameraY - 24.0) {
        this.recycleBug(pBug);
        continue;
      }

      trans.x = bug.x;
      trans.y = bug.y;

      pBug.rootNode.position.set(bug.x, bug.y, 0);

      let bugPhase = bug.gaitPhase;
      const legFrequency = (currentScrollSpeed + bug.speed) * 0.85;
      bugPhase += legFrequency * dt;
      bug.gaitPhase = bugPhase;

      // Sync spikes/safety visibility to the live spikedSide state:
      pBug.rootNode.getChildren().forEach((child) => {
        if (child.name === "left_spikes") {
          child.setEnabled(bug.spikedSide === "LEFT");
        }
        if (child.name === "right_spikes") {
          child.setEnabled(bug.spikedSide === "RIGHT");
        }
        if (child.name === "left_safety") {
          child.setEnabled(bug.spikedSide === "RIGHT" || bug.spikedSide === "NONE");
        }
        if (child.name === "right_safety") {
          child.setEnabled(bug.spikedSide === "LEFT" || bug.spikedSide === "NONE");
        }
      });
    }
  }

  private getNextLane(): number {
    if (this.laneBag.length === 0) {
      this.refillLaneBag();
    }
    const laneIndex = this.laneBag.pop()!;
    this.lastSelectedLaneIndex = laneIndex;
    return this.LANES[laneIndex];
  }

  private refillLaneBag(): void {
    const indices = [0, 1, 2, 3, 4, 5, 6];

    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = indices[i];
      indices[i] = indices[j];
      indices[j] = temp;
    }

    if (indices[indices.length - 1] === this.lastSelectedLaneIndex && indices.length > 1) {
      const temp = indices[indices.length - 1];
      indices[indices.length - 1] = indices[0];
      indices[0] = temp;
    }

    this.laneBag = indices;
  }

  private spawnBugFromPool(): void {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return;

    const pBug = this.bugPool.find((p) => !p.active);
    if (!pBug) return;

    const cameraY = scene.activeCamera
      ? scene.activeCamera.position.y
      : POST_PROCESSING_PRESETS.CAMERA.DEFAULT_TARGET.y;

    const startY = cameraY + 28.0;
    const startX = this.getNextLane();

    const heightScale = 1.0 + Math.random() * 0.6;
    const finalHeight = 7.2 * heightScale;
    const finalWidth = 1.15;

    const rand = Math.random();
    const spikedSide: "LEFT" | "RIGHT" | "NONE" =
      rand < 0.45 ? "LEFT" : rand < 0.9 ? "RIGHT" : "NONE";

    this.context.stores.get<TransformComponent>("transform").add(pBug.entityId, {
      x: startX,
      y: startY,
      z: 0,
      qx: 0,
      qy: 0,
      qz: 0,
      qw: 1,
      prevX: startX,
      prevY: startY,
      prevZ: 0,
      prevQx: 0,
      prevQy: 0,
      prevQz: 0,
      prevQw: 1,
      scaleX: 1.0,
      scaleY: heightScale,
      scaleZ: 1.0,
      prevScaleX: 1.0,
      prevScaleY: heightScale,
      prevScaleZ: 1.0
    });

    this.context.stores.get<WallBugComponent>("wallBug").add(pBug.entityId, {
      state: "CRAWLING_DOWN",
      x: startX,
      y: startY,
      width: finalWidth,
      height: finalHeight,
      speed: 3.42,
      gaitPhase: 0.0,
      spikedSide
    });

    this.context.stores.get<StickySurfaceComponent>("stickySurface").add(pBug.entityId, {
      isActive: true,
      width: finalWidth,
      height: finalHeight,
      speed: 3.42
    });

    pBug.rootNode.getChildren().forEach((child) => {
      if (child.name === "left_spikes") {
        child.setEnabled(spikedSide === "LEFT");
      }
      if (child.name === "right_spikes") {
        child.setEnabled(spikedSide === "RIGHT");
      }
      if (child.name === "left_safety") {
        child.setEnabled(spikedSide === "RIGHT" || spikedSide === "NONE");
      }
      if (child.name === "right_safety") {
        child.setEnabled(spikedSide === "LEFT" || spikedSide === "NONE");
      }
    });

    pBug.active = true;
    pBug.rootNode.position.set(startX, startY, 0);
    pBug.rootNode.setEnabled(true);
  }

  private recycleBug(pBug: PooledBug): void {
    pBug.active = false;
    pBug.rootNode.setEnabled(false);
    pBug.rootNode.position.set(0, -999, 0);

    const bugStore = this.context.stores.get<WallBugComponent>("wallBug");
    bugStore.remove(pBug.entityId);

    const stickyStore = this.context.stores.get<StickySurfaceComponent>("stickySurface");
    stickyStore.remove(pBug.entityId);

    const projStore = this.context.stores.get<ProjectileComponent>("projectile");
    if (projStore) {
      for (const [projId, proj] of projStore.entries()) {
        if (proj.isStuckToBug && proj.stickyEntityId === pBug.entityId) {
          proj.isActive = false;
          proj.isStuck = false;
          proj.isStuckToBug = false;
          proj.stickyEntityId = undefined;
          const mesh = this.context.visualQuery.getTransformNode(projId);
          if (mesh instanceof BABYLON.AbstractMesh) {
            mesh.isVisible = false;
            mesh.setEnabled(false);
            mesh.position.set(0, -999, 0);
            mesh.rotationQuaternion = BABYLON.Quaternion.Identity();
          }
        }
      }
    }

    const transformStore = this.context.stores.get<TransformComponent>("transform");
    const trans = transformStore.get(pBug.entityId);
    if (trans) {
      trans.x = 0;
      trans.y = -999;
      trans.prevX = 0;
      trans.prevY = -999;
      trans.scaleX = 1.0;
      trans.scaleY = 1.0;
      trans.scaleZ = 1.0;
      trans.prevScaleX = 1.0;
      trans.prevScaleY = 1.0;
      trans.prevScaleZ = 1.0;
    }
  }

  private clearAllBugs(): void {
    for (let i = 0; i < this.bugPool.length; i++) {
      this.recycleBug(this.bugPool[i]);
    }
    this.spawnTimer = 0.0;
  }

  public dispose(): void {
    this._tracker.clear();

    for (let i = 0; i < this.bugPool.length; i++) {
      const pBug = this.bugPool[i];
      this.context.visualRegistration.unregisterTransformNode(pBug.entityId);
    }
    this.bugPool = [];

    if (this.bugMaterial) this.bugMaterial.dispose();
    if (this.eyeMaterial) this.eyeMaterial.dispose();
  }
}
