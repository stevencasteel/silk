import { WebSplatStrategy } from "../juice/ParticleStrategies";
import { ProjectileNoisePlugin } from "../../visual/lighting/ProjectileNoisePlugin";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { GameEvent } from "../../core/events/GameEvents";
import { SystemContext } from "../../core/engine/SystemContext";
import { EntityId } from "../../core/ecs/Entity";
import {
  TransformComponent,
  KinematicVelocityComponent,
  ProjectileComponent,
  WeaverAIComponent,
  CollisionResponseComponent,
  TraversalStateComponent,
  BoundaryConstraintComponent,
  CollisionStateComponent,
  InvulnerabilityComponent,
  ParticleRequestComponent
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
    const scene = this.context.visualQuery.getScene();
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

      this.context.stores.get<BoundaryConstraintComponent>("boundaryConstraint").add(projId, {
        isActive: true,
        limitX: ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X,
        layer: "PROJECTILE",
        onBoundaryHit: (id: number, side: "LEFT" | "RIGHT", currentX: number) => {
          const pComp = this.context.stores.get<ProjectileComponent>("projectile").get(id);
          if (pComp && !pComp.isStuck) {
            const projTrans = this.context.stores.get<TransformComponent>("transform").get(id);
            const projCol = this.context.stores
              .get<CollisionStateComponent>("collisionState")
              .get(id);
            if (projTrans && projCol) {
              pComp.isStuck = true;
              pComp.isStuckOnWall = true;
              projTrans.x = Math.sign(currentX) * (ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X - 0.05);

              projCol.isWallClinging = true;
              projCol.wallNormalX = side === "RIGHT" ? -1 : 1;
              projCol.lastHitType = "WALL";
              projCol.hitPointX = projTrans.x;
              projCol.hitPointY = projTrans.y;

              const mesh = this.context.visualQuery.getTransformNode(id);
              if (mesh instanceof BABYLON.AbstractMesh) {
                mesh.scaling.set(0.24, 1.45, 1.45);
                mesh.position.x = projTrans.x;
                mesh.rotationQuaternion = BABYLON.Quaternion.Identity();
                const stuckMat = mesh.getScene().getMaterialByName("projectileMatStuck");
                if (stuckMat) {
                  mesh.material = stuckMat;
                }
              }

              this.context.broker.publish(GameEvent.PROJECTILE_IMPACT, {
                x: projTrans.x,
                y: projTrans.y,
                isWall: true
              });
            }
          }
        }
      });

      this.context.stores.get<CollisionResponseComponent>("collisionResponse").add(projId, {
        layer: "PROJECTILE",
        onOverlap: (otherId, ctx) => {
          const sysCtx = ctx as SystemContext;
          const pTrav = sysCtx.stores.get<TraversalStateComponent>("traversal").get(otherId);
          const pIframe = sysCtx.stores.get<InvulnerabilityComponent>("iframe").get(otherId);
          const pComp = sysCtx.stores.get<ProjectileComponent>("projectile").get(projId);
          const trans = sysCtx.stores.get<TransformComponent>("transform").get(projId);
          const pTrans = sysCtx.stores.get<TransformComponent>("transform").get(otherId);

          if (!pComp || !trans || !pTrans) return;

          const isLaunching = pTrav && pTrav.state === "LAUNCHING";
          const hasIframe = pIframe && pIframe.timeRemaining > 0;

          if (isLaunching) {
            const dx = trans.x - pTrans.x;
            const dy = trans.y - pTrans.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;

            const reqId = sysCtx.world.create();
            const reqStore = sysCtx.stores.get<ParticleRequestComponent>("particleRequest");
            if (reqStore) {
              reqStore.add(reqId, {
                strategy: new WebSplatStrategy(),
                x: trans.x,
                y: trans.y,
                z: trans.z
              });
            }

            sysCtx.broker.publish(GameEvent.PROJECTILE_IMPACT, {
              x: trans.x,
              y: trans.y,
              isWall: false
            });
            sysCtx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
              amplitude: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_AMP * 1.5,
              duration: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_DUR * 1.2,
              dirX: dx / dist,
              dirY: dy / dist
            });

            this.recycleProjectile(projId, pComp);
          } else if (!hasIframe) {
            sysCtx.commands.dispatch({
              type: "DAMAGE_REQUEST",
              targetId: otherId,
              amount: 1,
              source: "PROJECTILE"
            });

            const reqId = sysCtx.world.create();
            const reqStore = sysCtx.stores.get<ParticleRequestComponent>("particleRequest");
            if (reqStore) {
              reqStore.add(reqId, {
                strategy: new WebSplatStrategy(),
                x: trans.x,
                y: trans.y,
                z: trans.z
              });
            }

            sysCtx.broker.publish(GameEvent.PROJECTILE_IMPACT, {
              x: trans.x,
              y: trans.y,
              isWall: false
            });
            sysCtx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
              amplitude: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_AMP,
              duration: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_DUR
            });

            this.recycleProjectile(projId, pComp);
          }
        }
      });

      this.context.visualRegistration.registerTransformNode(projId, sphere);
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
    const mesh = this.context.visualQuery.getTransformNode(projId);

    if (!pComp || !trans || !vel || !(mesh instanceof BABYLON.AbstractMesh)) return;

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
    const transformStore = this.context.stores.get<TransformComponent>("transform");
    const projStore = this.context.stores.get<ProjectileComponent>("projectile");

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

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const projId = this.projectileEntities[i];
      const p = projStore.get(projId);
      if (!p || !p.isActive) continue;

      p.lifeTime += dt;

      const trans = transformStore.get(projId);
      const mesh = this.context.visualQuery.getTransformNode(projId);
      if (!trans || !(mesh instanceof BABYLON.AbstractMesh)) continue;

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

  public recycleProjectile(projId: EntityId, p: ProjectileComponent): void {
    if (!p) return;
    p.isActive = false;
    p.isStuck = false;
    p.isStuckOnWall = false;
    p.lifeTime = 0.0;
    p.fallbackX = 0.0;
    p.fallbackY = 0.0;

    const trans = this.context.stores.get<TransformComponent>("transform").get(projId);
    const vel = this.context.stores.get<KinematicVelocityComponent>("velocity").get(projId);
    const mesh = this.context.visualQuery.getTransformNode(projId);

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

    if (mesh instanceof BABYLON.AbstractMesh) {
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
        mesh instanceof BABYLON.AbstractMesh ? mesh.position : BABYLON.Vector3.Zero(),
        mesh instanceof BABYLON.AbstractMesh
          ? mesh.rotationQuaternion || BABYLON.Quaternion.Identity()
          : BABYLON.Quaternion.Identity()
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
