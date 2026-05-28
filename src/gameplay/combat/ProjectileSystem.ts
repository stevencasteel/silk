import { ProjectileNoisePlugin } from "../../visual/lighting/ProjectileNoisePlugin";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { GameEvent } from "../../core/events/GameEvents";
import { SystemContext } from "../../core/engine/SystemContext";
import { EntityId } from "../../core/ecs/Entity";
import {
  HealthComponent,
  InvulnerabilityComponent,
  WeaverAIComponent,
  TraversalStateComponent,
  TransformComponent,
  KinematicVelocityComponent,
  ProjectileComponent
} from "../../core/ecs/Components";
import { ARENA_CONFIG, WEAVER_AI_TUNING, VISUAL_JUICE_CONFIG } from "../../core/engine/ArenaConfig";
import * as BABYLON from "@babylonjs/core";

export class ProjectileSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;

  private projectileEntities: EntityId[] = [];
  private bodiesMap = new Map<EntityId, BABYLON.PhysicsBody | null>();

  private readonly POOL_SIZE = WEAVER_AI_TUNING.SHOOT.POOL_SIZE;
  private nextPoolIndex = 0;
  private sharedShape: BABYLON.PhysicsShapeSphere | null = null;

  private projMatActive: BABYLON.PBRMaterial | null = null;
  private projMatStuck: BABYLON.PBRMaterial | null = null;
  private unsubShoot: (() => void) | null = null;
  private unsubReset: (() => void) | null = null;
  private noiseTime = 0.0;

  constructor(private context: SystemContext) {}

  public init(): void {
    const scene = this.context.visualRegistry.getScene();
    if (!scene) return;

    this.projMatActive = this.createBaseProjectileMaterial("projectileMatActive", scene);
    const noisePlugin = new ProjectileNoisePlugin(this.projMatActive);
    (
      this.projMatActive as BABYLON.PBRMaterial & { _noisePlugin?: ProjectileNoisePlugin }
    )._noisePlugin = noisePlugin;

    this.projMatStuck = this.createBaseProjectileMaterial("projectileMatStuck", scene);

    if (scene.isPhysicsEnabled()) {
      this.sharedShape = new BABYLON.PhysicsShapeSphere(
        BABYLON.Vector3.Zero(),
        WEAVER_AI_TUNING.SHOOT.PROJECTILE_DIAMETER / 2,
        scene
      );
      this.sharedShape.material = { friction: 0.1, restitution: 0.6 };
    }

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const projId = this.context.world.create();
      this.projectileEntities.push(projId);

      const sphere = BABYLON.MeshBuilder.CreateSphere(
        `projectile_pooled_${i}`,
        { diameter: WEAVER_AI_TUNING.SHOOT.PROJECTILE_DIAMETER },
        scene
      );
      sphere.position.set(0, -999, 0);
      sphere.material = this.projMatActive;
      sphere.isVisible = false;
      sphere.setEnabled(false);

      let body: BABYLON.PhysicsBody | null = null;
      if (scene.isPhysicsEnabled() && this.sharedShape) {
        body = new BABYLON.PhysicsBody(sphere, BABYLON.PhysicsMotionType.ANIMATED, false, scene);
        body.shape = this.sharedShape;
        body.setMassProperties({ mass: 1.0 });
        body.disablePreStep = false;
      }

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
        prevQw: 1
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
        fallbackY: 0.0
      });

      this.context.visualRegistry.registerTransformNode(projId, sphere);
      this.bodiesMap.set(projId, body);
    }

    this.unsubShoot = this.context.broker.subscribe(GameEvent.WEAVER_SHOOT, (payload) => {
      this.spawnProjectile(payload.x, payload.y, payload.tx, payload.ty);
    });

    this.unsubReset = this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
      this.clearAll();
      this.noiseTime = 0.0;
    });
  }

  private createBaseProjectileMaterial(name: string, scene: BABYLON.Scene): BABYLON.PBRMaterial {
    const mat = new BABYLON.PBRMaterial(name, scene);
    mat.albedoColor = new BABYLON.Color3(0.95, 0.95, 0.98);
    mat.metallic = VISUAL_JUICE_CONFIG.MATERIALS.PROJECTILE.METALLIC;
    mat.roughness = VISUAL_JUICE_CONFIG.MATERIALS.PROJECTILE.ROUGHNESS;
    mat.sheen.isEnabled = true;
    mat.sheen.intensity = VISUAL_JUICE_CONFIG.MATERIALS.PROJECTILE.SHEEN_INTENSITY;
    return mat;
  }

  private spawnProjectile(x: number, y: number, tx: number, ty: number): void {
    let projId = -1;
    const projStore = this.context.stores.get<ProjectileComponent>("projectile");

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
        this.recycleProjectile(projId, pComp);
      }
      this.nextPoolIndex = (this.nextPoolIndex + 1) % this.POOL_SIZE;
    }

    const pComp = projStore.get(projId);
    const trans = this.context.stores.get<TransformComponent>("transform").get(projId);
    const vel = this.context.stores.get<KinematicVelocityComponent>("velocity").get(projId);
    const mesh = this.context.visualRegistry.getTransformNode(projId) as BABYLON.Mesh;

    if (!pComp || !trans || !vel || !mesh) return;

    pComp.isActive = true;
    pComp.isStuck = false;
    pComp.isStuckOnWall = false;
    pComp.lifeTime = 0.0;

    trans.x = x;
    trans.y = y;
    trans.z = 0;
    trans.prevX = x;
    trans.prevY = y;
    trans.prevZ = 0;

    mesh.position.set(x, y, 0);
    mesh.scaling.set(0.7, 1.5, 0.7);
    mesh.material = this.projMatActive;
    mesh.isVisible = true;
    mesh.setEnabled(true);

    const dx = tx - x;
    const dy = ty - y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = WEAVER_AI_TUNING.SHOOT.SPEED;

    vel.x = (dx / dist) * speed;
    vel.y = (dy / dist) * speed;

    pComp.fallbackX = vel.x;
    pComp.fallbackY = vel.y;

    const angle = Math.atan2(vel.y, vel.x) - Math.PI / 2;
    if (!mesh.rotationQuaternion) {
      mesh.rotationQuaternion = new BABYLON.Quaternion();
    }
    BABYLON.Quaternion.RotationAxisToRef(BABYLON.Axis.Z, angle, mesh.rotationQuaternion);

    trans.qx = mesh.rotationQuaternion.x;
    trans.qy = mesh.rotationQuaternion.y;
    trans.qz = mesh.rotationQuaternion.z;
    trans.qw = mesh.rotationQuaternion.w;

    trans.prevQx = trans.qx;
    trans.prevQy = trans.qy;
    trans.prevQz = trans.qz;
    trans.prevQw = trans.qw;

    const body = this.bodiesMap.get(projId);
    if (body) {
      body.setTargetTransform(mesh.position, mesh.rotationQuaternion);
    }
  }

  public update(dt: number): void {
    const healthStore = this.context.stores.get<HealthComponent>("health");
    const iframeStore = this.context.stores.get<InvulnerabilityComponent>("iframe");
    const traversalStore = this.context.stores.get<TraversalStateComponent>("traversal");
    const transformStore = this.context.stores.get<TransformComponent>("transform");
    const velStore = this.context.stores.get<KinematicVelocityComponent>("velocity");
    const projStore = this.context.stores.get<ProjectileComponent>("projectile");

    const pHealth = healthStore.get(this.context.refs.player);
    const wHealth = healthStore.get(this.context.refs.weaver);
    const pIframe = iframeStore.get(this.context.refs.player);
    const pTrav = traversalStore.get(this.context.refs.player);

    if (!pHealth || !wHealth || !pIframe) return;
    if (pHealth.current <= 0 || wHealth.current <= 0) return;

    this.noiseTime += dt;
    if (this.projMatActive) {
      const noisePlugin = (
        this.projMatActive as BABYLON.PBRMaterial & { _noisePlugin?: ProjectileNoisePlugin }
      )._noisePlugin;
      if (noisePlugin) {
        noisePlugin.time = this.noiseTime;
      }
    }

    const wAI = this.context.stores
      .get<WeaverAIComponent>("weaverAI")
      .get(this.context.refs.weaver);
    const currentScrollSpeed = wAI ? wAI.scrollSpeed : 12.0;
    const pMesh = this.context.visualRegistry.getTransformNode(
      this.context.refs.player
    ) as BABYLON.AbstractMesh;
    const wallLimit = ARENA_CONFIG.HORIZONTAL.PLAY_AREA_HALF_WIDTH;

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const projId = this.projectileEntities[i];
      const p = projStore.get(projId);
      if (!p || !p.isActive) continue;

      p.lifeTime += dt;

      const trans = transformStore.get(projId);
      const vel = velStore.get(projId);
      const mesh = this.context.visualRegistry.getTransformNode(projId) as BABYLON.Mesh;
      if (!trans || !vel || !mesh) continue;

      if (!p.isStuck) {
        trans.x += vel.x * dt;
        trans.y += vel.y * dt;
        mesh.position.set(trans.x, trans.y, 0);

        const body = this.bodiesMap.get(projId);
        if (body) {
          body.setTargetTransform(
            mesh.position,
            mesh.rotationQuaternion || BABYLON.Quaternion.Identity()
          );
        }

        if (Math.abs(trans.x) >= wallLimit) {
          p.isStuck = true;
          p.isStuckOnWall = true;
          mesh.scaling.set(0.24, 1.45, 1.45);
          trans.x = Math.sign(trans.x) * (wallLimit - 0.05);
          mesh.position.x = trans.x;
          mesh.rotationQuaternion = BABYLON.Quaternion.Identity();
          mesh.material = this.projMatStuck;

          trans.qx = 0;
          trans.qy = 0;
          trans.qz = 0;
          trans.qw = 1;

          if (body) {
            body.setTargetTransform(mesh.position, mesh.rotationQuaternion);
          }

          this.context.broker.publish(GameEvent.PROJECTILE_IMPACT, {
            x: trans.x,
            y: trans.y,
            isWall: true
          });
        }

        if (!p.isStuck && pMesh) {
          if (mesh.intersectsMesh(pMesh, false)) {
            const isLaunching = pTrav && pTrav.state === "LAUNCHING";
            const hasIframe = pIframe.timeRemaining > 0;

            if (isLaunching) {
              const dx = trans.x - pMesh.position.x;
              const dy = trans.y - pMesh.position.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;

              this.context.broker.publish(GameEvent.PROJECTILE_IMPACT, {
                x: trans.x,
                y: trans.y,
                isWall: false
              });
              this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
                amplitude: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_AMP * 1.5,
                duration: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_DUR * 1.2,
                dirX: dx / dist,
                dirY: dy / dist
              });
              this.recycleProjectile(projId, p);
              continue;
            } else if (!hasIframe) {
              this.context.commands.dispatch({
                type: "DAMAGE_REQUEST",
                targetId: this.context.refs.player,
                amount: 1,
                source: "PROJECTILE"
              });

              this.context.broker.publish(GameEvent.PROJECTILE_IMPACT, {
                x: trans.x,
                y: trans.y,
                isWall: false
              });
              this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
                amplitude: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_AMP,
                duration: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_DUR
              });
              this.recycleProjectile(projId, p);
              continue;
            }
          }
        }
      }

      if (p.isStuckOnWall) {
        trans.y -= currentScrollSpeed * dt;
        mesh.position.y = trans.y;
        const body = this.bodiesMap.get(projId);
        if (body) {
          body.setTargetTransform(
            mesh.position,
            mesh.rotationQuaternion || BABYLON.Quaternion.Identity()
          );
        }
      }

      if (
        trans.y < ARENA_CONFIG.PROJECTILE.OFFSCREEN_MIN_Y ||
        trans.y > ARENA_CONFIG.PROJECTILE.OFFSCREEN_MAX_Y ||
        p.lifeTime > WEAVER_AI_TUNING.SHOOT.MAX_LIFE
      ) {
        this.recycleProjectile(projId, p);
      }
    }
  }

  private recycleProjectile(projId: EntityId, p: ProjectileComponent): void {
    if (!p) return;
    p.isActive = false;
    p.isStuck = false;
    p.isStuckOnWall = false;
    p.lifeTime = 0.0;
    p.fallbackX = 0.0;
    p.fallbackY = 0.0;

    const trans = this.context.stores.get<TransformComponent>("transform").get(projId);
    const vel = this.context.stores.get<KinematicVelocityComponent>("velocity").get(projId);
    const mesh = this.context.visualRegistry.getTransformNode(projId) as BABYLON.Mesh;

    if (trans) {
      trans.x = 0;
      trans.y = -999;
      trans.z = 0;
      trans.prevX = 0;
      trans.prevY = -999;
      trans.prevZ = 0;
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
        mesh ? (mesh.rotationQuaternion || BABYLON.Quaternion.Identity()) : BABYLON.Quaternion.Identity()
      );
    }
  }

  private clearAll(): void {
    const projStore = this.context.stores.get<ProjectileComponent>("projectile");
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const projId = this.projectileEntities[i];
      const p = projStore.get(projId);
      if (p) this.recycleProjectile(projId, p);
    }
  }

  public dispose(): void {
    if (this.unsubShoot) this.unsubShoot();
    if (this.unsubReset) this.unsubReset();
    this.clearAll();
    if (this.sharedShape) this.sharedShape.dispose();

    this.bodiesMap.forEach((body) => {
      if (body) body.dispose();
    });
    this.bodiesMap.clear();

    this.projectileEntities.forEach((id) => {
      this.context.world.destroy(id);
    });
    this.projectileEntities = [];

    if (this.projMatActive) this.projMatActive.dispose();
    if (this.projMatStuck) this.projMatStuck.dispose();
  }
}
