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
  private readonly spawnInterval = 5.0;
  private bugMaterial: BABYLON.PBRMaterial | null = null;
  private eyeMaterial: BABYLON.StandardMaterial | null = null;
  private _tracker = new SubscriptionTracker();

  private bugPool: PooledBug[] = [];
  private readonly POOL_SIZE = 4;

  constructor(private context: SystemContext) {}

  public init(): void {
    const scene = this.context.visualRegistry.getScene();
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

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const bugId = this.context.world.create();
      const bugRoot = this.buildBugMeshHierarchy(bugId, scene);
      bugRoot.setEnabled(false);

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
      })
    );
  }

  public update(dt: number): void {
    const scene = this.context.visualRegistry.getScene();
    if (!scene) return;

    this.spawnTimer += dt;
    const activeCount = this.bugPool.filter((p) => p.active).length;

    if (this.spawnTimer >= this.spawnInterval && activeCount < 3) {
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

      // Wall bug kinematics translation is cleanly handled by KinematicIntegrationSystem.
      // We only execute scroll-tracking updates and check vertical bounds.
      const extraCrawlSpeed = 3.8;
      bug.y -= (currentScrollSpeed + extraCrawlSpeed) * dt;

      if (bug.y < cameraY - 24.0) {
        this.recycleBug(pBug);
        continue;
      }

      trans.x = bug.x;
      trans.y = bug.y;

      pBug.rootNode.position.set(bug.x, bug.y, 0);

      // Simple kinematic frequency tracker (Procedural joint animation is isolated to RenderSync)
      let bugPhase = bug.gaitPhase;
      const legFrequency = (currentScrollSpeed + bug.speed) * 0.85;
      bugPhase += legFrequency * dt;
      bug.gaitPhase = bugPhase;
    }
  }

  private spawnBugFromPool(): void {
    const scene = this.context.visualRegistry.getScene();
    if (!scene) return;

    const pBug = this.bugPool.find((p) => !p.active);
    if (!pBug) return;

    const cameraY = scene.activeCamera
      ? scene.activeCamera.position.y
      : POST_PROCESSING_PRESETS.CAMERA.DEFAULT_TARGET.y;
    const side = Math.random() < 0.5 ? -1 : 1;
    const startX = side * 6.2;
    const startY = cameraY + 22.0;

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
      prevQw: 1
    });

    this.context.stores.get<WallBugComponent>("wallBug").add(pBug.entityId, {
      state: "CRAWLING_DOWN",
      timer: 0.0,
      x: startX,
      y: startY,
      width: 1.15,
      height: 7.2,
      speed: 3.8,
      stayDuration: 0.0,
      gaitPhase: 0.0
    });

    this.context.stores.get<StickySurfaceComponent>("stickySurface").add(pBug.entityId, {
      isActive: true,
      width: 1.15,
      height: 7.2,
      speed: 3.8
    });

    pBug.active = true;
    pBug.rootNode.position.set(startX, startY, 0);
    pBug.rootNode.setEnabled(true);

    this.context.visualRegistry.registerTransformNode(pBug.entityId, pBug.rootNode);
  }

  private recycleBug(pBug: PooledBug): void {
    pBug.active = false;
    pBug.rootNode.setEnabled(false);
    pBug.rootNode.position.set(0, -999, 0);

    const bugStore = this.context.stores.get<WallBugComponent>("wallBug");
    bugStore.remove(pBug.entityId);

    const stickyStore = this.context.stores.get<StickySurfaceComponent>("stickySurface");
    stickyStore.remove(pBug.entityId);

    const transformStore = this.context.stores.get<TransformComponent>("transform");
    transformStore.remove(pBug.entityId);

    this.context.visualRegistry.unregisterTransformNode(pBug.entityId);
  }

  private buildBugMeshHierarchy(id: number, scene: BABYLON.Scene): BABYLON.TransformNode {
    const bugRoot = new BABYLON.TransformNode(`wall_bug_root_${id}`, scene);

    const capsule = BABYLON.MeshBuilder.CreateCapsule(
      `wall_bug_capsule_${id}`,
      { height: 7.2, radius: 0.58, subdivisions: 2 },
      scene
    );
    capsule.material = this.bugMaterial;
    capsule.parent = bugRoot;

    for (let i = 0; i < 5; i++) {
      const ring = BABYLON.MeshBuilder.CreateTorus(
        `ring_${id}_${i}`,
        { diameter: 1.2, thickness: 0.1, tessellation: 8 },
        scene
      );
      ring.position.y = -2.6 + i * 1.3;
      ring.rotation.x = Math.PI / 2;
      ring.material = this.bugMaterial;
      ring.parent = bugRoot;
    }

    const eyeL = BABYLON.MeshBuilder.CreateSphere(`eyeL_${id}`, { diameter: 0.18 }, scene);
    eyeL.position.set(-0.25, -3.1, -0.42);
    eyeL.material = this.eyeMaterial;
    eyeL.parent = bugRoot;

    const eyeR = BABYLON.MeshBuilder.CreateSphere(`eyeR_${id}`, { diameter: 0.18 }, scene);
    eyeR.position.set(0.25, -3.1, -0.42);
    eyeR.material = this.eyeMaterial;
    eyeR.parent = bugRoot;

    for (let leg = 0; leg < 4; leg++) {
      const legY = -2.0 + leg * 1.35;

      const jointL = new BABYLON.TransformNode(`leg_joint_left_${id}_${leg}`, scene);
      jointL.position.set(-0.45, legY, 0);
      jointL.parent = bugRoot;

      const coxaL = BABYLON.MeshBuilder.CreateCylinder(
        `coxaL_${id}_${leg}`,
        { height: 0.7, diameterTop: 0.11, diameterBottom: 0.08, tessellation: 6 },
        scene
      );
      coxaL.position.set(-0.35, 0, 0);
      coxaL.rotation.z = Math.PI / 2;
      coxaL.material = this.bugMaterial;
      coxaL.parent = jointL;

      const tibiaJointL = new BABYLON.TransformNode(`tibia_joint_left_${id}_${leg}`, scene);
      tibiaJointL.position.set(-0.7, 0, 0);
      tibiaJointL.rotation.z = Math.PI / 4;
      tibiaJointL.parent = jointL;

      const tibiaL = BABYLON.MeshBuilder.CreateCylinder(
        `tibiaL_${id}_${leg}`,
        { height: 0.6, diameterTop: 0.08, diameterBottom: 0.05, tessellation: 6 },
        scene
      );
      tibiaL.position.set(0, -0.3, 0);
      tibiaL.material = this.bugMaterial;
      tibiaL.parent = tibiaJointL;

      const footL = BABYLON.MeshBuilder.CreateSphere(
        `footL_${id}_${leg}`,
        { diameterX: 0.14, diameterY: 0.18, diameterZ: 0.14 },
        scene
      );
      footL.position.set(0, -0.6, 0);
      footL.material = this.eyeMaterial;
      footL.parent = tibiaJointL;

      const jointR = new BABYLON.TransformNode(`leg_joint_right_${id}_${leg}`, scene);
      jointR.position.set(0.45, legY, 0);
      jointR.parent = bugRoot;

      const coxaR = BABYLON.MeshBuilder.CreateCylinder(
        `coxaR_${id}_${leg}`,
        { height: 0.7, diameterTop: 0.11, diameterBottom: 0.08, tessellation: 6 },
        scene
      );
      coxaR.position.set(0.35, 0, 0);
      coxaR.rotation.z = -Math.PI / 2;
      coxaR.material = this.bugMaterial;
      coxaR.parent = jointR;

      const tibiaJointR = new BABYLON.TransformNode(`tibia_joint_right_${id}_${leg}`, scene);
      tibiaJointR.position.set(0.7, 0, 0);
      tibiaJointR.rotation.z = -Math.PI / 4;
      tibiaJointR.parent = jointR;

      const tibiaR = BABYLON.MeshBuilder.CreateCylinder(
        `tibiaR_${id}_${leg}`,
        { height: 0.6, diameterTop: 0.08, diameterBottom: 0.05, tessellation: 6 },
        scene
      );
      tibiaR.position.set(0, -0.3, 0);
      tibiaR.material = this.bugMaterial;
      tibiaR.parent = tibiaJointR;

      const footR = BABYLON.MeshBuilder.CreateSphere(
        `footR_${id}_${leg}`,
        { diameterX: 0.14, diameterY: 0.18, diameterZ: 0.14 },
        scene
      );
      footR.position.set(0, -0.6, 0);
      footR.material = this.eyeMaterial;
      footR.parent = tibiaJointR;
    }

    return bugRoot;
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
      pBug.rootNode.dispose();
    }
    this.bugPool = [];

    if (this.bugMaterial) this.bugMaterial.dispose();
    if (this.eyeMaterial) this.eyeMaterial.dispose();
  }
}
