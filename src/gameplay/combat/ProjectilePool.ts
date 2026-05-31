import * as BABYLON from "@babylonjs/core";
import { SystemContext } from "../../core/engine/SystemContext";
import { EntityId } from "../../core/ecs/Entity";
import { WEAVER_AI_TUNING, VISUAL_JUICE_CONFIG, ARENA_CONFIG } from "../../core/engine/ArenaConfig";
import { ProjectileNoisePlugin } from "../../visual/lighting/ProjectileNoisePlugin";
import {
  TransformComponent,
  KinematicVelocityComponent,
  ProjectileComponent,
  BoundaryConstraintComponent,
  CollisionResponseComponent
} from "../../core/ecs/Components";

export interface PooledProjectile {
  id: EntityId;
  mesh: BABYLON.Mesh;
  body: BABYLON.PhysicsBody | null;
}

export class ProjectilePool {
  private projectileEntities: EntityId[] = [];
  private meshesMap = new Map<EntityId, BABYLON.Mesh>();
  private bodiesMap = new Map<EntityId, BABYLON.PhysicsBody | null>();
  private redStatusMap = new Map<EntityId, boolean>();

  private readonly POOL_SIZE = WEAVER_AI_TUNING.SHOOT.POOL_SIZE;
  private nextPoolIndex = 0;
  private sharedShape: BABYLON.PhysicsShapeSphere | null = null;

  public projMatActive: BABYLON.PBRMaterial;
  public projMatActiveRed: BABYLON.PBRMaterial;
  public projMatStuck: BABYLON.PBRMaterial;
  public projMatStuckRed: BABYLON.PBRMaterial;
  public projMatTrapped: BABYLON.PBRMaterial;

  constructor(
    private context: SystemContext,
    private scene: BABYLON.Scene,
    private onBoundaryHitCallback: (id: number, side: "LEFT" | "RIGHT", currentX: number) => void,
    private onOverlapCallback: (otherId: number, projId: number) => void
  ) {
    this.projMatActive = this.createBaseProjectileMaterial("projectileMatActive");
    const noisePlugin = new ProjectileNoisePlugin(this.projMatActive);
    (this.projMatActive as BABYLON.PBRMaterial & { _noisePlugin?: ProjectileNoisePlugin })._noisePlugin = noisePlugin;

    this.projMatActiveRed = this.createBaseProjectileMaterial("projectileMatActiveRed");
    this.projMatActiveRed.albedoColor = new BABYLON.Color3(0.95, 0.05, 0.05);
    const noisePluginRed = new ProjectileNoisePlugin(this.projMatActiveRed);
    (this.projMatActiveRed as BABYLON.PBRMaterial & { _noisePlugin?: ProjectileNoisePlugin })._noisePlugin = noisePluginRed;

    this.projMatStuck = this.createBaseProjectileMaterial("projectileMatStuck");
    this.projMatStuckRed = this.createBaseProjectileMaterial("projectileMatStuckRed");
    this.projMatStuckRed.albedoColor = new BABYLON.Color3(0.95, 0.05, 0.05);

    this.projMatTrapped = this.createBaseProjectileMaterial("projectileMatTrapped");
    const trappedNoise = new ProjectileNoisePlugin(this.projMatTrapped);
    (this.projMatTrapped as BABYLON.PBRMaterial & { _noisePlugin?: ProjectileNoisePlugin })._noisePlugin = trappedNoise;

    if (this.scene.isPhysicsEnabled()) {
      this.sharedShape = new BABYLON.PhysicsShapeSphere(
        BABYLON.Vector3.Zero(),
        WEAVER_AI_TUNING.SHOOT.PROJECTILE_DIAMETER / 2,
        this.scene
      );
      this.sharedShape.material = { friction: 0.1, restitution: 0.6 };
    }

    this.initializePool();
  }

  private createBaseProjectileMaterial(name: string): BABYLON.PBRMaterial {
    const mat = new BABYLON.PBRMaterial(name, this.scene);
    mat.albedoColor = new BABYLON.Color3(0.95, 0.95, 0.98);
    mat.metallic = VISUAL_JUICE_CONFIG.MATERIALS.PROJECTILE.METALLIC;
    mat.roughness = VISUAL_JUICE_CONFIG.MATERIALS.PROJECTILE.ROUGHNESS;
    mat.sheen.isEnabled = true;
    mat.sheen.intensity = VISUAL_JUICE_CONFIG.MATERIALS.PROJECTILE.SHEEN_INTENSITY;
    return mat;
  }

  private initializePool(): void {
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const projId = this.context.world.create();
      this.projectileEntities.push(projId);

      const sphere = BABYLON.MeshBuilder.CreateSphere(
        `projectile_pooled_${i}`,
        { diameter: WEAVER_AI_TUNING.SHOOT.PROJECTILE_DIAMETER },
        this.scene
      );
      sphere.position.set(0, -999, 0);
      sphere.material = this.projMatActive;
      sphere.isVisible = false;
      sphere.setEnabled(false);

      let body: BABYLON.PhysicsBody | null = null;
      if (this.scene.isPhysicsEnabled() && this.sharedShape) {
        body = new BABYLON.PhysicsBody(sphere, BABYLON.PhysicsMotionType.ANIMATED, false, this.scene);
        body.shape = this.sharedShape;
        body.setMassProperties({ mass: 1.0 });
        body.disablePreStep = false;
      }

      this.meshesMap.set(projId, sphere);
      this.bodiesMap.set(projId, body);
      this.redStatusMap.set(projId, false);

      this.context.stores.get<TransformComponent>("transform").add(projId, {
        x: 0,
        y: -999,
        z: 0,
        qx: 0,
        qy: 0,
        qz: 0,
        qw: 1,
        prevX: 0,
        prevY: -999,
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

      this.context.stores.get<KinematicVelocityComponent>("velocity").add(projId, {
        x: 0,
        y: 0,
        z: 0
      });

      this.context.stores.get<ProjectileComponent>("projectile").add(projId, {
        isActive: false,
        isStuck: false,
        isStuckOnWall: false,
        lifeTime: 0.0,
        fallbackX: 0.0,
        fallbackY: 0.0,
        isTrappingPlayer: false
      });

      this.context.stores.get<BoundaryConstraintComponent>("boundaryConstraint").add(projId, {
        isActive: true,
        limitX: ARENA_CONFIG.HORIZONTAL.PLAY_AREA_HALF_WIDTH,
        layer: "PROJECTILE",
        onBoundaryHit: (id, side, currentX) => this.onBoundaryHitCallback(id, side, currentX)
      });

      this.context.stores.get<CollisionResponseComponent>("collisionResponse").add(projId, {
        layer: "PROJECTILE",
        onOverlap: (otherId) => this.onOverlapCallback(otherId, projId)
      });

      this.context.visualRegistration.registerTransformNode(projId, sphere);
    }
  }

  public acquire(x: number, y: number, isRelease: boolean, shotCounter: number): EntityId {
    const projStore = this.context.stores.get<ProjectileComponent>("projectile");

    if (isRelease) {
      let chargingProjId = -1;
      for (let i = 0; i < this.POOL_SIZE; i++) {
        const pid = this.projectileEntities[i];
        const p = projStore.get(pid);
        if (p && p.isActive && p.isCharging) {
          chargingProjId = pid;
          break;
        }
      }

      if (chargingProjId !== -1) {
        return chargingProjId;
      }
    }

    let projId = -1;
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const idx = (this.nextPoolIndex + i) % this.POOL_SIZE;
      const pid = this.projectileEntities[idx];
      const pComp = projStore.get(pid);
      if (pComp && !pComp.isActive) {
        projId = pid;
        this.nextPoolIndex = (idx + 1) % this.POOL_SIZE;
        break;
      }
    }

    if (projId === -1) {
      projId = this.projectileEntities[this.nextPoolIndex];
      const pComp = projStore.get(projId);
      if (pComp) {
        this.release(projId);
      }
      this.nextPoolIndex = (this.nextPoolIndex + 1) % this.POOL_SIZE;
    }

    const pComp = projStore.get(projId);
    const trans = this.context.stores.get<TransformComponent>("transform").get(projId);
    const vel = this.context.stores.get<KinematicVelocityComponent>("velocity").get(projId);
    const mesh = this.meshesMap.get(projId);

    if (pComp && trans && vel && mesh) {
      const isRed = (shotCounter % 3 === 2);
      this.redStatusMap.set(projId, isRed);

      pComp.isActive = true;
      pComp.isStuck = false;
      pComp.isStuckOnWall = false;
      pComp.isTrappingPlayer = false;
      pComp.lifeTime = 0.0;
      pComp.isCharging = true;
      pComp.isRed = isRed;

      trans.x = x;
      trans.y = y;
      trans.z = 0;
      trans.prevX = x;
      trans.prevY = y;
      trans.prevZ = 0;

      trans.scaleX = 0.001;
      trans.scaleY = 0.001;
      trans.scaleZ = 0.001;
      trans.prevScaleX = 0.001;
      trans.prevScaleY = 0.001;
      trans.prevScaleZ = 0.001;
      trans.scaleVelX = 0;
      trans.scaleVelY = 0;
      trans.scaleVelZ = 0;

      mesh.position.set(x, y, 0);
      mesh.scaling.set(0.001, 0.001, 0.001);
      mesh.material = isRed ? this.projMatActiveRed : this.projMatActive;
      mesh.isVisible = true;
      mesh.setEnabled(true);

      vel.x = 0;
      vel.y = 0;

      const wId = this.context.refs.weaver;
      const wTrans = this.context.stores.get<TransformComponent>("transform").get(wId);
      if (wTrans) {
        trans.qx = wTrans.qx;
        trans.qy = wTrans.qy;
        trans.qz = wTrans.qz;
        trans.qw = wTrans.qw;
        trans.prevQx = wTrans.prevQx;
        trans.prevQy = wTrans.prevQy;
        trans.prevQz = wTrans.prevQz;
        trans.prevQw = wTrans.prevQw;
        if (!mesh.rotationQuaternion) {
          mesh.rotationQuaternion = new BABYLON.Quaternion();
        }
        mesh.rotationQuaternion.set(trans.qx, trans.qy, trans.qz, trans.qw);
      }

      const body = this.bodiesMap.get(projId);
      if (body) {
        body.setTargetTransform(mesh.position, mesh.rotationQuaternion || BABYLON.Quaternion.Identity());
      }
    }

    return projId;
  }

  public release(projId: EntityId): void {
    const p = this.context.stores.get<ProjectileComponent>("projectile").get(projId);
    if (!p) return;

    p.isActive = false;
    p.isStuck = false;
    p.isStuckOnWall = false;
    p.isTrappingPlayer = false;
    p.lifeTime = 0.0;
    p.fallbackX = 0.0;
    p.fallbackY = 0.0;
    p.isStuckToBug = false;
    p.stickyEntityId = undefined;
    p.stickyOffsetX = 0;
    p.stickyOffsetY = 0;

    const trans = this.context.stores.get<TransformComponent>("transform").get(projId);
    const vel = this.context.stores.get<KinematicVelocityComponent>("velocity").get(projId);
    const mesh = this.meshesMap.get(projId);

    if (trans) {
      trans.x = 0;
      trans.y = -999;
      trans.z = 0;
      trans.prevX = 0;
      trans.prevY = -999;
      trans.prevZ = 0;
      trans.scaleX = 1.0;
      trans.scaleY = 1.0;
      trans.scaleZ = 1.0;
      trans.prevScaleX = 1.0;
      trans.prevScaleY = 1.0;
      trans.prevScaleZ = 1.0;
    }

    if (vel) {
      vel.x = 0;
      vel.y = 0;
    }

    if (mesh) {
      mesh.isVisible = false;
      mesh.setEnabled(false);
      mesh.position.set(0, -999, 0);
      mesh.scaling.set(1.0, 1.0, 1.0);
      mesh.rotationQuaternion = BABYLON.Quaternion.Identity();
      mesh.material = this.projMatActive;
    }

    const body = this.bodiesMap.get(projId);
    if (body) {
      body.setTargetTransform(
        mesh ? mesh.position : BABYLON.Vector3.Zero(),
        mesh ? mesh.rotationQuaternion || BABYLON.Quaternion.Identity() : BABYLON.Quaternion.Identity()
      );
    }
  }

  public getMesh(projId: EntityId): BABYLON.Mesh | undefined {
    return this.meshesMap.get(projId);
  }

  public getBody(projId: EntityId): BABYLON.PhysicsBody | null | undefined {
    return this.bodiesMap.get(projId);
  }

  public isRed(projId: EntityId): boolean {
    return this.redStatusMap.get(projId) || false;
  }

  public getEntities(): EntityId[] {
    return this.projectileEntities;
  }

  public reset(): void {
    for (let i = 0; i < this.POOL_SIZE; i++) {
      this.release(this.projectileEntities[i]);
    }
  }

  public dispose(): void {
    this.reset();
    if (this.sharedShape) this.sharedShape.dispose();

    this.bodiesMap.forEach((body) => {
      if (body) body.dispose();
    });
    this.bodiesMap.clear();

    for (const id of this.meshesMap.keys()) {
      this.context.visualRegistration.unregisterTransformNode(id);
    }
    this.meshesMap.clear();

    this.projectileEntities.forEach((id) => {
      this.context.world.destroy(id);
    });
    this.projectileEntities = [];

    this.projMatActive.dispose();
    this.projMatActiveRed.dispose();
    this.projMatStuck.dispose();
    this.projMatStuckRed.dispose();
    this.projMatTrapped.dispose();
  }
}
