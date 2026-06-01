import { triggerMeshFadeIn } from "../../core/utils/EngineUtils";
import { ISystem } from "../../contracts/ISystem";
import { SubscriptionTracker } from "../../core/utils/EngineUtils";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  TransformComponent,
  SpikeBugComponent,
  StickySurfaceComponent,
  ProjectileComponent,
  HealthComponent
} from "../../core/ecs/Components";
import { POST_PROCESSING_PRESETS, ARENA_CONFIG } from "../../core/engine/ArenaConfig";
import { GameEvent } from "../../core/events/GameEvents";
import { FaunaVisualFactory } from "../../visual/mesh/FaunaVisualFactory";
import * as BABYLON from "@babylonjs/core";

interface PooledSpikeBug {
  entityId: number;
  rootNode: BABYLON.TransformNode;
  active: boolean;
}

export class SpikeBugSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;
  readonly initPhase = InitPhase.Gameplay;

  private spawnTimer = 0.0;
  private spawnLeft = true;

  private bugPool: PooledSpikeBug[] = [];
  private readonly POOL_SIZE = 4;
  private _tracker = new SubscriptionTracker();

  constructor(private context: SystemContext) {}

  private getSpawnInterval(): number {
    const hits = this.context.runtime.weaverDamageCount;
    if (hits === 0) return 1.0;
    if (hits === 1) return 1.6;
    if (hits === 2) return 2.4;
    return 3.5; // Density dialed down as other hazards crowd the playfield
  }

  public init(): void {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return;

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const bugId = this.context.world.create();
      const bugRoot = FaunaVisualFactory.buildSpikeBug(bugId, scene, "LEFT");
      bugRoot.setEnabled(false);
      bugRoot.position.set(0, -999, 0);

      this.context.visualRegistration.registerTransformNode(bugId, bugRoot);

      this.bugPool.push({
        entityId: bugId,
        rootNode: bugRoot,
        active: false
      });
    }

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.clearAllBugs();
        this.spawnTimer = 0.0;
        this.spawnLeft = true;
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_OVER, () => {
        this.clearAllBugs();
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_WIN, () => {
        this.clearAllBugs();
      })
    );
  }

  public update(dt: number): void {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return;

    const healthStore = this.context.stores.get<HealthComponent>("health");
    const wHealth = healthStore.get(this.context.refs.weaver);

    if (this.context.runtime.gameStarted && wHealth && wHealth.current > 0) {
      this.spawnTimer += dt;
      const activeCount = this.bugPool.filter((p) => p.active).length;
      const currentSpawnInterval = this.getSpawnInterval();

      if (this.spawnTimer >= currentSpawnInterval && activeCount < this.POOL_SIZE) {
        this.spawnTimer = 0.0;
        this.spawnBugFromPool();
      }
    }

    const cameraY = scene.activeCamera
      ? scene.activeCamera.position.y
      : POST_PROCESSING_PRESETS.CAMERA.DEFAULT_TARGET.y;

    const currentScrollSpeed = this.context.runtime.currentScrollSpeed;
    const transformStore = this.context.stores.get<TransformComponent>("transform");
    const sBugStore = this.context.stores.get<SpikeBugComponent>("spikeBug");
    const stickyStore = this.context.stores.get<StickySurfaceComponent>("stickySurface");

    for (let i = 0; i < this.bugPool.length; i++) {
      const pBug = this.bugPool[i];
      if (!pBug.active) continue;

      const bug = sBugStore.get(pBug.entityId);
      const trans = transformStore.get(pBug.entityId);
      const sticky = stickyStore.get(pBug.entityId);

          if (!bug || !trans || !sticky) continue;

          if (bug.state === "WALKING_UP") {
            bug.y += bug.speed * dt;
            sticky.speed = -bug.speed;
          } else {
            bug.y -= currentScrollSpeed * dt;
            sticky.speed = 0;
          }

          if (bug.y > cameraY + 30.0 || bug.y < cameraY - 32.0) {
            this.recycleBug(pBug);
            continue;
          }

          trans.x = bug.x;
          trans.y = bug.y;
          pBug.rootNode.position.set(bug.x, bug.y, 0);

          const legFrequency = 12.0;
          bug.gaitPhase = (bug.gaitPhase + legFrequency * dt) % (Math.PI * 2.0);

          pBug.rootNode.getChildren().forEach((child) => {
            if (child.name.startsWith("leg_joint")) {
              const legIdx = parseInt(child.name.substring(child.name.lastIndexOf("_") + 1)) || 0;
              const swing = Math.sin(bug.gaitPhase + legIdx * 1.5) * 0.25;
              (child as BABYLON.TransformNode).rotation.z = swing;
            }

            if (child.name === "spikes") {
              if (bug.spikesDisarmed) {
                child.setEnabled(false);
              } else {
                child.setEnabled(true);
              }
            }
          });
        }
      }

      private spawnBugFromPool(): void {
        const scene = this.context.visualQuery.getScene();
        if (!scene) return;

        const pBug = this.bugPool.find((p) => !p.active);
        if (!pBug) return;

        const cameraY = scene.activeCamera
          ? scene.activeCamera.position.y
          : POST_PROCESSING_PRESETS.CAMERA.DEFAULT_TARGET.y;

        const startY = cameraY - 28.0;

        const isTwoWallsAllowed = this.context.runtime.weaverDamageCount >= 1;
        const sideSign = isTwoWallsAllowed
          ? (this.spawnLeft ? -1 : 1)
          : -1;

        const startX = sideSign * ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;
        
        const spikedSide: "LEFT" | "RIGHT" = isTwoWallsAllowed
          ? (this.spawnLeft ? "RIGHT" : "LEFT")
          : "RIGHT";

        if (isTwoWallsAllowed) {
          this.spawnLeft = !this.spawnLeft;
        }

        this.context.visualRegistration.unregisterTransformNode(pBug.entityId);
        pBug.rootNode.dispose();

        pBug.rootNode = FaunaVisualFactory.buildSpikeBug(pBug.entityId, scene, spikedSide);
        this.context.visualRegistration.registerTransformNode(pBug.entityId, pBug.rootNode);

        pBug.rootNode.position.set(startX, startY, 0);
        pBug.rootNode.setEnabled(true);
        triggerMeshFadeIn(pBug.rootNode, 0.4);

        const bodyHeight = 5.5;
        const bodyWidth = 1.1;

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
          scaleY: 1.0,
          scaleZ: 1.0,
          prevScaleX: 1.0,
          prevScaleY: 1.0,
          prevScaleZ: 1.0
        });

        this.context.stores.get<SpikeBugComponent>("spikeBug").add(pBug.entityId, {
          state: "WALKING_UP",
          x: startX,
          y: startY,
          width: bodyWidth,
          height: bodyHeight,
          speed: 4.25,
          gaitPhase: 0.0,
          spikedSide,
          spikesDisarmed: false
        });

        this.context.stores.get<StickySurfaceComponent>("stickySurface").add(pBug.entityId, {
          isActive: true,
          width: bodyWidth,
          height: bodyHeight,
          speed: -4.25
        });

        pBug.active = true;
      }

      private recycleBug(pBug: PooledSpikeBug): void {
        pBug.active = false;
        pBug.rootNode.setEnabled(false);
        pBug.rootNode.position.set(0, -999, 0);

        this.context.stores.get<SpikeBugComponent>("spikeBug").remove(pBug.entityId);
        this.context.stores.get<StickySurfaceComponent>("stickySurface").remove(pBug.entityId);

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
        }
      }

      private clearAllBugs(): void {
        for (let i = 0; i < this.bugPool.length; i++) {
          this.recycleBug(this.bugPool[i]);
        }
        this.spawnTimer = 0.0;
        this.spawnLeft = true;
      }

      public dispose(): void {
        this._tracker.clear();
        for (let i = 0; i < this.bugPool.length; i++) {
          const pBug = this.bugPool[i];
          this.context.visualRegistration.unregisterTransformNode(pBug.entityId);
        }
        this.bugPool = [];
      }
    }
