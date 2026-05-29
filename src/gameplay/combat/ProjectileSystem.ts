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
import { getWeaverAbdomenTip } from "../../core/utils/EngineUtils";
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

  private _scratchPos = new BABYLON.Vector3();
  private _scratchRot = new BABYLON.Quaternion();

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
        onBoundaryHit: (id: number, side: "LEFT" | "RIGHT", currentX: number) => {
          const pComp = this.context.stores.get<ProjectileComponent>("projectile").get(id);
          if (pComp && !pComp.isStuck && !pComp.isTrappingPlayer) {
            const projTrans = this.context.stores.get<TransformComponent>("transform").get(id);
            const projCol = this.context.stores
              .get<CollisionStateComponent>("collisionState")
              .get(id);
            const projVel = this.context.stores.get<KinematicVelocityComponent>("velocity").get(id);
            if (projTrans && projCol) {
              pComp.isStuck = true;
              pComp.isStuckOnWall = true;

              projTrans.x = Math.sign(currentX) * (ARENA_CONFIG.HORIZONTAL.PLAY_AREA_HALF_WIDTH - 0.05);
              projTrans.prevX = projTrans.x;

              if (projVel) {
                projVel.x = 0;
                projVel.y = 0;
              }

              projTrans.qx = 0;
              projTrans.qy = 0;
              projTrans.qz = 0;
              projTrans.qw = 1;
              projTrans.prevQx = 0;
              projTrans.prevQy = 0;
              projTrans.prevQz = 0;
              projTrans.prevQw = 1;

              projTrans.scaleX = 0.24;
              projTrans.scaleY = 1.45;
              projTrans.scaleZ = 1.45;
              projTrans.prevScaleX = 0.24;
              projTrans.prevScaleY = 1.45;
              projTrans.prevScaleZ = 1.45;

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

          if (!pComp || !trans || !pTrans || pComp.isTrappingPlayer) return;

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
          } else {
            const alreadyTrapped = pTrav && pTrav.isWebTrapped;
            if (alreadyTrapped && pTrav) {
              pTrav.webMass = (pTrav.webMass || 1) + 1;
              pTrav.escapeRequired = 5 + (pTrav.webMass - 1) * 3;

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
                amplitude: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_AMP * 0.8,
                duration: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_DUR
              });

              if (!hasIframe) {
                sysCtx.commands.dispatch({
                  type: "DAMAGE_REQUEST",
                  targetId: otherId,
                  amount: 1,
                  source: "PROJECTILE"
                });
              }

              this.recycleProjectile(projId, pComp);
              return;
            }

            if (!hasIframe) {
              const dx = pTrans.x - trans.x;
              const dy = pTrans.y - trans.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
              const kickbackSpeed = 16.0;

              if (pTrav) {
                pTrav.isWebTrapped = true;
                pTrav.webMass = 1;
                pTrav.escapeProgress = 0;
                pTrav.escapeRequired = 5;
                pTrav.lastEscapeDirection = "";
                pTrav.hasFlingBonus = false;
              }

              pComp.isTrappingPlayer = true;

              const pVel = sysCtx.stores.get<KinematicVelocityComponent>("velocity").get(otherId);
              if (pVel) {
                pVel.x = (dx / dist) * kickbackSpeed;
                pVel.y = (dy / dist) * kickbackSpeed;
              }

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
            }
          }
        }
      });

      this.context.visualRegistration.registerTransformNode(projId, sphere);
      this.bodiesMap.set(projId, body);
    }

    this.unsubShoot = this.context.broker.subscribe(GameEvent.WEAVER_SHOOT, (payload) => {
      this.spawnProjectile(payload.x, payload.y, payload.tx, payload.ty, !!payload.isRelease);
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

  private spawnProjectile(x: number, y: number, tx: number, ty: number, isRelease: boolean = false): void {
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
        const pComp = projStore.get(chargingProjId)!;
        const trans = this.context.stores.get<TransformComponent>("transform").get(chargingProjId);
        const vel = this.context.stores.get<KinematicVelocityComponent>("velocity").get(chargingProjId);
        const mesh = this.context.visualQuery.getTransformNode(chargingProjId);

        if (pComp && trans && vel && mesh instanceof BABYLON.AbstractMesh) {
          pComp.isCharging = false;
          pComp.lifeTime = 0.0;
          
          const dx = tx - trans.x;
          const dy = ty - trans.y;
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

          trans.scaleX = 0.45;
          trans.scaleY = 2.4;
          trans.scaleZ = 0.45;
          trans.prevScaleX = trans.scaleX;
          trans.prevScaleY = trans.scaleY;
          trans.prevScaleZ = trans.scaleZ;

          const body = this.bodiesMap.get(chargingProjId);
          if (body) {
            body.setTargetTransform(mesh.position, mesh.rotationQuaternion);
          }

          const wId = this.context.refs.weaver;
          const wTrans = this.context.stores.get<TransformComponent>("transform").get(wId);
          if (wTrans) {
            const recoilIntensity = 8.0;
            const rx = -(dx / dist) * recoilIntensity;
            const ry = -(dy / dist) * recoilIntensity;
            if (wTrans.scaleVelX !== undefined) wTrans.scaleVelX += rx;
            if (wTrans.scaleVelY !== undefined) wTrans.scaleVelY += ry;
          }

          const reqId = this.context.world.create();
          const reqStore = this.context.stores.get<ParticleRequestComponent>("particleRequest");
          if (reqStore) {
            reqStore.add(reqId, {
              strategy: new WebSplatStrategy(),
              x: trans.x,
              y: trans.y,
              z: trans.z
            });
          }
          return;
        }
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
    pComp.isTrappingPlayer = false;
    pComp.lifeTime = 0.0;
    pComp.isCharging = true;

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
    mesh.material = this.projMatActive;
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
    } else {
      trans.qx = 0;
      trans.qy = 0;
      trans.qz = 0;
      trans.qw = 1;
      trans.prevQx = 0;
      trans.prevQy = 0;
      trans.prevQz = 0;
      trans.prevQw = 1;
    }

    const body = this.bodiesMap.get(projId);
    if (body) {
      body.setTargetTransform(mesh.position, mesh.rotationQuaternion || BABYLON.Quaternion.Identity());
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

    // Safety fallback check to see if the Weaver is actively in PATROLLING state.
    // If wAI component is temporarily missing or unset during a system loop transition, we default to true.
    const isPatrolling = wAI ? wAI.state === "PATROLLING" : true;

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const projId = this.projectileEntities[i];
      const p = projStore.get(projId);
      if (!p || !p.isActive) continue;

      p.lifeTime += dt;

      const trans = transformStore.get(projId);
      const mesh = this.context.visualQuery.getTransformNode(projId);
      if (!trans || !(mesh instanceof BABYLON.AbstractMesh)) continue;

      if (p.isTrappingPlayer) {
        const pTrans = transformStore.get(this.context.refs.player);
        const pTrav = this.context.stores.get<TraversalStateComponent>("traversal").get(this.context.refs.player);

        if (!pTrav || !pTrav.isWebTrapped || !pTrans) {
          this.recycleProjectile(projId, p);
          continue;
        }

        const massScale = 1.0 + ((pTrav.webMass || 1) - 1) * 0.18;

        if (pTrav.state === "WALL_SLIDING") {
          // Flatten rotation entirely so it runs aligned and flush to the flat vertical wall
          trans.qx = 0;
          trans.qy = 0;
          trans.qz = 0;
          trans.qw = 1;
          trans.prevQx = 0;
          trans.prevQy = 0;
          trans.prevQz = 0;
          trans.prevQw = 1;

          if (!mesh.rotationQuaternion) {
            mesh.rotationQuaternion = new BABYLON.Quaternion();
          }
          mesh.rotationQuaternion.set(0, 0, 0, 1);

          // Squashed flat scale mimicking wall stuck shot geometry
          trans.scaleX = 0.28 * massScale;
          trans.scaleY = 2.0 * massScale;
          trans.scaleZ = 2.0 * massScale;

          // Push the splatted web slightly closer into/towards the wall so the player capsule pokes out
          const wallOffset = pTrav.wallDir * 0.25;
          trans.x = pTrans.x + wallOffset;
          trans.y = pTrans.y;
          trans.z = pTrans.z;

          trans.prevX = pTrans.prevX + wallOffset;
          trans.prevY = pTrans.prevY;
          trans.prevZ = pTrans.prevZ;

          // Stop undulations by swapping to the solid static material
          if (mesh.material !== this.projMatStuck) {
            mesh.material = this.projMatStuck;
          }
        } else {
          // If airborne or launching, use standard spherical, undulating web scaling and active material
          trans.scaleX = 1.0 * massScale;
          trans.scaleY = 1.15 * massScale;
          trans.scaleZ = 1.0 * massScale;

          trans.x = pTrans.x;
          trans.y = pTrans.y;
          trans.z = pTrans.z;

          trans.prevX = pTrans.prevX;
          trans.prevY = pTrans.prevY;
          trans.prevZ = pTrans.prevZ;

          if (mesh.material !== this.projMatActive) {
            mesh.material = this.projMatActive;
          }
        }

        mesh.position.set(trans.x, trans.y, trans.z);
        mesh.scaling.set(trans.scaleX, trans.scaleY, trans.scaleZ);

        const body = this.bodiesMap.get(projId);
        if (body) {
          this._scratchPos.set(trans.x, trans.y, trans.z);
          this._scratchRot.set(trans.qx, trans.qy, trans.qz, trans.qw);
          body.setTargetTransform(this._scratchPos, this._scratchRot);
        }
      } else if (p.isStuckOnWall) {
        trans.y -= currentScrollSpeed * dt;
        mesh.position.y = trans.y;
        const body = this.bodiesMap.get(projId);
        if (body) {
          body.setTargetTransform(
            mesh.position,
            mesh.rotationQuaternion || BABYLON.Quaternion.Identity()
          );
        }
      } else if (p.isCharging) {
        // Interruption guard: If the boss state shifts away from PATROLLING (takes damage, enters striking/shockwave),
        // cleanly shatter the actively growing ball to prevent orphaned web nodes.
        if (!isPatrolling) {
          const reqStore = this.context.stores.get<ParticleRequestComponent>("particleRequest");
          if (reqStore) {
            const reqId = this.context.world.create();
            reqStore.add(reqId, {
              strategy: new WebSplatStrategy(),
              x: trans.x,
              y: trans.y,
              z: trans.z
            });
          }

          this.context.broker.publish(GameEvent.PROJECTILE_IMPACT, {
            x: trans.x,
            y: trans.y,
            isWall: false
          });

          this.recycleProjectile(projId, p);
          continue;
        }

        const wTrans = transformStore.get(this.context.refs.weaver);
        if (wTrans) {
          const radius = ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
          const tipWorld = getWeaverAbdomenTip(
            wTrans.x,
            wTrans.y,
            wTrans.z,
            wTrans.qx,
            wTrans.qy,
            wTrans.qz,
            wTrans.qw,
            radius,
            1.0
          );

          trans.x = tipWorld.x;
          trans.y = tipWorld.y;
          trans.z = tipWorld.z;
          trans.prevX = tipWorld.x;
          trans.prevY = tipWorld.y;
          trans.prevZ = tipWorld.z;

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

        const progress = Math.min(1.0, p.lifeTime / WEAVER_AI_TUNING.SHOOT.TELEGRAPH_TIME);
        const undulateSpeed = 30.0;
        const undulateAmp = 0.08 * (1.0 - progress);
        const pulse = 1.0 + Math.sin(p.lifeTime * undulateSpeed) * (0.05 + undulateAmp);
        const currentBallScale = progress * pulse;

        trans.prevScaleX = trans.scaleX;
        trans.prevScaleY = trans.scaleY;
        trans.prevScaleZ = trans.scaleZ;

        trans.scaleX = currentBallScale;
        trans.scaleY = currentBallScale;
        trans.scaleZ = currentBallScale;

        mesh.position.set(trans.x, trans.y, trans.z);
        mesh.scaling.set(trans.scaleX, trans.scaleY, trans.scaleZ);

        const body = this.bodiesMap.get(projId);
        if (body) {
          this._scratchPos.set(trans.x, trans.y, trans.z);
          this._scratchRot.set(trans.qx, trans.qy, trans.qz, trans.qw);
          body.setTargetTransform(this._scratchPos, this._scratchRot);
        }
      } else {
        const flyTime = p.lifeTime;
        const wobbleSpeed = 45.0;
        const wobbleAmp = 0.06;
        const wobble = Math.sin(flyTime * wobbleSpeed) * wobbleAmp;

        trans.prevScaleX = trans.scaleX;
        trans.prevScaleY = trans.scaleY;
        trans.prevScaleZ = trans.scaleZ;

        trans.scaleX = 0.65 * (1.0 + wobble);
        trans.scaleY = 1.75 * (1.0 - wobble);
        trans.scaleZ = 0.65 * (1.0 + wobble);

        mesh.position.set(trans.x, trans.y, trans.z);
        mesh.scaling.set(trans.scaleX, trans.scaleY, trans.scaleZ);

        const body = this.bodiesMap.get(projId);
        if (body) {
          this._scratchPos.set(trans.x, trans.y, trans.z);
          this._scratchRot.set(trans.qx, trans.qy, trans.qz, trans.qw);
          body.setTargetTransform(this._scratchPos, this._scratchRot);
        }
      }

      if (
        (!p.isTrappingPlayer && trans.y < ARENA_CONFIG.PROJECTILE.OFFSCREEN_MIN_Y) ||
        (!p.isTrappingPlayer && trans.y > ARENA_CONFIG.PROJECTILE.OFFSCREEN_MAX_Y) ||
        (!p.isTrappingPlayer && p.lifeTime > WEAVER_AI_TUNING.SHOOT.MAX_LIFE)
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
    p.isTrappingPlayer = false;
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
