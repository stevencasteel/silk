import { ISystem } from "../../contracts/ISystem";
import { SubscriptionTracker } from "../../core/utils/EngineUtils";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  TransformComponent,
  WallBugComponent,
  StickySurfaceComponent
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
  private readonly spawnInterval = 3.2; // Frequent spawns every 3.2 seconds
  private bugMaterial: BABYLON.PBRMaterial | null = null;
  private eyeMaterial: BABYLON.StandardMaterial | null = null;
  private _tracker = new SubscriptionTracker();

  private bugPool: PooledBug[] = [];
  private readonly POOL_SIZE = 2; // Up to two on screen at once

  // Semi-random Grab Bag containing 7 unique balanced vertical lanes.
  // Constrained to the central 40% corridor [-5.0, 5.0] to satisfy the 30% wall-exclusion rule.
  private laneBag: number[] = [];
  private readonly LANES = [-5.0, -3.0, -1.0, 0.0, 1.0, 3.0, 5.0];
  private lastSelectedLaneIndex = -1;

  constructor(private context: SystemContext) {}

  public init(): void {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return;

    this.bugMaterial = new BABYLON.PBRMaterial("wallBugCarapace", scene);
    this.bugMaterial.metallic = 0.95;
    this.bugMaterial.roughness = 0.12;
    this.bugMaterial.albedoColor = new BABYLON.Color3(0.18, 0.18, 0.22);
    this.bugMaterial.emissiveColor = new BABYLON.Color3(0.85, 0.35, 0.0);
    this.bugMaterial.emissiveIntensity = 1.25;

    this.eyeMaterial = new BABYLON.StandardMaterial("wallBugEyes", scene);
    this.eyeMaterial.emissiveColor = new BABYLON.Color3(1.0, 0.55, 0.0);
    this.eyeMaterial.disableLighting = true;

    // Pre-initialize and pre-register pool meshes to visual registry EXACTLY once
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

      // Register with the visual registry so they are managed during active loops
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

    // Spawns up to a maximum of 2 on screen at once
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

      bug.timer += dt;

      const extraCrawlSpeed = 3.8;
      bug.y -= (currentScrollSpeed + extraCrawlSpeed) * dt;

      // Dispose trigger: Recycle bug once it falls past the bottom viewport threshold
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
    }
  }

  // Draw non-consecutively repeating lanes using Tetris-style bag-shuffling
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

    // Fisher-Yates Shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = indices[i];
      indices[i] = indices[j];
      indices[j] = temp;
    }

    // Boundary Protection: If first index of new bag matches last indices of old bag, swap it
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

    // Elevate starting coordinate so bugs spawn completely above the viewport and crawl down naturally into view
    const startY = cameraY + 28.0;

    // Retrieve lane through shuffle bag to block repeat consecutive spawns
    const startX = this.getNextLane();

    // Dynamic height scaling: stretches Y scale dynamically from 1.0x (7.2 short) up to 1.6x (11.52 tall)
    const heightScale = 1.0 + Math.random() * 0.6;
    const finalHeight = 7.2 * heightScale;
    const finalWidth = 1.15;

    // Reset both current and previous coordinates to the spawn position.
    // This blocks interpolation rendering glitches when a cached mesh is repurposed.
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
      timer: 0.0,
      x: startX,
      y: startY,
      width: finalWidth,
      height: finalHeight,
      speed: 3.8,
      stayDuration: 0.0,
      gaitPhase: 0.0
    });

    this.context.stores.get<StickySurfaceComponent>("stickySurface").add(pBug.entityId, {
      isActive: true,
      width: finalWidth,
      height: finalHeight,
      speed: 3.8
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

    // Reposition coordinates out of sight so interpolation scripts ignore them
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

    // Cleanly unregister and dispose of pool meshes ONLY during total system teardown
    for (let i = 0; i < this.bugPool.length; i++) {
      const pBug = this.bugPool[i];
      this.context.visualRegistration.unregisterTransformNode(pBug.entityId);
    }
    this.bugPool = [];

    if (this.bugMaterial) this.bugMaterial.dispose();
    if (this.eyeMaterial) this.eyeMaterial.dispose();
  }
}
