import { WEB_SPLAT_STRATEGY } from "../juice/ParticleStrategies";
import { SilkMaterialPlugin } from "../../visual/lighting/SilkMaterialPlugin";
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
  TraversalStateComponent,
  CollisionStateComponent,
  InvulnerabilityComponent,
  ParticleRequestComponent,
  WallBugComponent,
  HealthBugComponent,
  HealthComponent,
  TetherComponent
} from "../../core/ecs/Components";
import { ARENA_CONFIG, WEAVER_AI_TUNING, VISUAL_JUICE_CONFIG, GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";
import { getWeaverAbdomenTip, SubscriptionTracker } from "../../core/utils/EngineUtils";
import { ProjectilePool } from "./ProjectilePool";
import * as BABYLON from "@babylonjs/core";

export class ProjectileSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;
  private pool!: ProjectilePool;

  private shotCounter = 0;
  private noiseTime = 0.0;
  private _tracker = new SubscriptionTracker();

  private _scratchPos = new BABYLON.Vector3();
  private _scratchRot = new BABYLON.Quaternion();

  constructor(private context: SystemContext) {}

  public init(): void {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return;

    this.pool = new ProjectilePool(
      this.context,
      scene,
      (id, side, currentX) => this.handleBoundaryHit(id, side, currentX),
      (otherId, projId) => this.handleOverlap(otherId, projId)
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.WEAVER_SHOOT, (payload) => {
        this.spawnProjectile(payload.x, payload.y, payload.tx, payload.ty, !!payload.isRelease);
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.pool.reset();
        this.noiseTime = 0.0;
        this.shotCounter = 0;
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_OVER, () => {
        this.pool.reset();
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_WIN, () => {
        this.pool.reset();
      })
    );
  }

  private handleBoundaryHit(id: EntityId, side: "LEFT" | "RIGHT", currentX: number): void {
    const pComp = this.context.stores.get<ProjectileComponent>("projectile").get(id);
    if (pComp && !pComp.isStuck && !pComp.isTrappingPlayer) {
      const projTrans = this.context.stores.get<TransformComponent>("transform").get(id);
      const projCol = this.context.stores.get<CollisionStateComponent>("collisionState").get(id);
      const projVel = this.context.stores.get<KinematicVelocityComponent>("velocity").get(id);

      if (projTrans && projCol) {
        pComp.isStuck = true;
        pComp.isStuckOnWall = true;

        const PROJECTILE_WALL_OFFSET = 0.05;
        projTrans.x = Math.sign(currentX) * (ARENA_CONFIG.HORIZONTAL.PLAY_AREA_HALF_WIDTH - PROJECTILE_WALL_OFFSET);
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

        const mesh = this.pool.getMesh(id);
        if (mesh) {
          mesh.scaling.set(0.24, 1.45, 1.45);
          mesh.position.x = projTrans.x;
          mesh.rotationQuaternion = BABYLON.Quaternion.Identity();
          const stuckMat = mesh
            .getScene()
            .getMaterialByName(pComp.isRed ? "projectileMatStuckRed" : "projectileMatStuck");
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

  private handleOverlap(otherId: EntityId, projId: EntityId): void {
    const sysCtx = this.context;
    const pTrav = sysCtx.stores.get<TraversalStateComponent>("traversal").get(otherId);
    const pIframe = sysCtx.stores.get<InvulnerabilityComponent>("iframe").get(otherId);
    const pComp = sysCtx.stores.get<ProjectileComponent>("projectile").get(projId);
    const trans = sysCtx.stores.get<TransformComponent>("transform").get(projId);
    const pTrans = sysCtx.stores.get<TransformComponent>("transform").get(otherId);
    const pHealth = sysCtx.stores.get<HealthComponent>("health").get(otherId);

    if (!pComp || !trans || !pTrans || pComp.isTrappingPlayer || (pHealth && pHealth.current <= 0))
      return;

    const isLaunching = pTrav && pTrav.state === "LAUNCHING";
    const hasIframe = pIframe && pIframe.timeRemaining > 0;
    const launchPower = pTrav ? pTrav.launchPower || 0 : 0;

    // Fling/launch deflection check
    if (isLaunching && launchPower >= 0.555) {
      const dx = trans.x - pTrans.x;
      const dy = trans.y - pTrans.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;

      const reqId = sysCtx.world.create();
      const reqStore = sysCtx.stores.get<ParticleRequestComponent>("particleRequest");
      if (reqStore) {
        reqStore.add(reqId, {
          strategy: WEB_SPLAT_STRATEGY,
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

      if (launchPower > 0.8) {
        sysCtx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
          amplitude: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_AMP * 1.5,
          duration: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_DUR * 1.2,
          dirX: dx / dist,
          dirY: dy / dist
        });
        this.pool.release(projId);
      } else {
        const vel = sysCtx.stores.get<KinematicVelocityComponent>("velocity").get(projId);
        if (vel) {
          const deflectAngle = Math.PI / 2 + (Math.random() - 0.5) * 1.0;
          const deflectSpeed = WEAVER_AI_TUNING.SHOOT.SPEED * 0.95;
          vel.x = Math.cos(deflectAngle) * deflectSpeed;
          vel.y = Math.sin(deflectAngle) * deflectSpeed;
          pComp.fallbackX = vel.x;
          pComp.fallbackY = vel.y;
        }
        sysCtx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
          amplitude: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_AMP * 0.5,
          duration: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_DUR * 0.6
        });
      }
      return;
    }

    // ALREADY TRAPPED CASE
    const alreadyTrapped = pTrav && pTrav.isWebTrapped;
    if (alreadyTrapped && pTrav) {
      pTrav.webMass = (pTrav.webMass || 1) + 1;
      pTrav.escapeRequired = 5 + (pTrav.webMass - 1) * 3;
      pTrav.escapeProgress = Math.max(0, (pTrav.escapeProgress || 0) - 1);
      pTrav.recoilTimer = 0.35;

      const dx = pTrans.x - trans.x;
      const dy = pTrans.y - trans.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
      const pushX = dx / dist;
      const pushY = dy / dist;

      // Cumulative physical push
      const pVel = sysCtx.stores.get<KinematicVelocityComponent>("velocity").get(otherId);
      const pushForce = 22.0;
      if (pVel) {
        pVel.x += pushX * pushForce;
        pVel.y += pushY * pushForce + 2.0;
      }

      // Extend tether reel length on consecutive hits
      const tetherStore = sysCtx.stores.get<TetherComponent>("tether");
      const tether = tetherStore ? tetherStore.get(otherId) : undefined;
      if (tether && tether.isAttached) {
        const reelIncrease = 5.0;
        const maxLengthLimit = GAMEPLAY_TUNING.REEL.MAX_LENGTH;
        tether.desiredLength = Math.min(maxLengthLimit, tether.desiredLength + reelIncrease);
        tether.maxLength = Math.min(maxLengthLimit, tether.maxLength + reelIncrease);
      }

      if (!hasIframe) {
        sysCtx.commands.dispatch({
          type: "DAMAGE_REQUEST",
          targetId: otherId,
          amount: 1,
          source: "PROJECTILE_STACK"
        });
      }

      const reqId = sysCtx.world.create();
      const reqStore = sysCtx.stores.get<ParticleRequestComponent>("particleRequest");
      if (reqStore) {
        reqStore.add(reqId, {
          strategy: WEB_SPLAT_STRATEGY,
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
        amplitude: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_AMP * 1.3,
        duration: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_DUR * 1.1,
        dirX: pushX,
        dirY: pushY
      });

      this.pool.release(projId);
      return;
    }

    // FRESH TRAP CASE (First web impact)
    const dx = pTrans.x - trans.x;
    const dy = pTrans.y - trans.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
    const pushX = dx / dist;
    const pushY = dy / dist;

    // 1. Force state transition to AIRBORNE to handle physics-based push cleanly
    if (pTrav) {
      pTrav.state = "AIRBORNE";
      pTrav.wallDir = 0;
      pTrav.wallNormalX = 0;
      pTrav.wallNormalY = 0;
      pTrav.stickyEntityId = -1;
    }

    // 2. Physics-based push: apply high-impulse velocity away from the projectile
    const pVel = sysCtx.stores.get<KinematicVelocityComponent>("velocity").get(otherId);
    const pushForce = 28.0;
    if (pVel) {
      pVel.x = pushX * pushForce;
      pVel.y = pushY * pushForce + 4.0;
    }

    // 3. Make player's reel get longer (simulating unspooling/elongating)
    const tetherStore = sysCtx.stores.get<TetherComponent>("tether");
    const tether = tetherStore ? tetherStore.get(otherId) : undefined;
    if (tether && tether.isAttached) {
      const reelIncrease = 8.5;
      const maxLengthLimit = GAMEPLAY_TUNING.REEL.MAX_LENGTH;
      tether.desiredLength = Math.min(maxLengthLimit, tether.desiredLength + reelIncrease);
      tether.maxLength = Math.min(maxLengthLimit, tether.maxLength + reelIncrease);
      tether.tension = Math.max(tether.tension, 1.25);
    }

    // 4. Trap in web cocoon
    if (pTrav) {
      pTrav.isWebTrapped = true;
      pTrav.webMass = 1;
      pTrav.escapeProgress = 0;
      pTrav.escapeRequired = 5;
      pTrav.lastEscapeDirection = "";
      pTrav.hasFlingBonus = false;
      pTrav.recoilTimer = 0.35;
    }

    pComp.isTrappingPlayer = true;

    // 5. Apply damage & i-frame logic
    if (!hasIframe) {
      sysCtx.commands.dispatch({
        type: "DAMAGE_REQUEST",
        targetId: otherId,
        amount: 1,
        source: "PROJECTILE"
      });
    }

    // 6. Visual juice and effects
    const reqId = sysCtx.world.create();
    const reqStore = sysCtx.stores.get<ParticleRequestComponent>("particleRequest");
    if (reqStore) {
      reqStore.add(reqId, {
        strategy: WEB_SPLAT_STRATEGY,
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
      amplitude: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_AMP * 1.8,
      duration: WEAVER_AI_TUNING.SHOOT.CAMERA_SHAKE_DUR * 1.4,
      dirX: pushX,
      dirY: pushY
    });
  }

  private spawnProjectile(
    x: number,
    y: number,
    tx: number,
    ty: number,
    isRelease: boolean = false
  ): void {
    const projId = this.pool.acquire(x, y, isRelease, this.shotCounter);
    if (projId === -1) return;

    const pComp = this.context.stores.get<ProjectileComponent>("projectile").get(projId);
    const trans = this.context.stores.get<TransformComponent>("transform").get(projId);
    const vel = this.context.stores.get<KinematicVelocityComponent>("velocity").get(projId);
    const mesh = this.pool.getMesh(projId);

    if (pComp && trans && vel && mesh) {
      if (isRelease && pComp.isCharging) {
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

        const body = this.pool.getBody(projId);
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
            strategy: WEB_SPLAT_STRATEGY,
            x: trans.x,
            y: trans.y,
            z: trans.z
          });
        }
      } else {
        this.shotCounter++;
      }
    }
  }

  public update(dt: number): void {
    const transformStore = this.context.stores.get<TransformComponent>("transform");
    const projStore = this.context.stores.get<ProjectileComponent>("projectile");

    this.noiseTime += dt;
    if (this.pool.projMatActive) {
      const noisePlugin = (
        this.pool.projMatActive as BABYLON.PBRMaterial & { _noisePlugin?: SilkMaterialPlugin }
      )._noisePlugin;
      if (noisePlugin) noisePlugin.time = this.noiseTime;
    }
    if (this.pool.projMatActiveRed) {
      const noisePluginRed = (
        this.pool.projMatActiveRed as BABYLON.PBRMaterial & { _noisePlugin?: SilkMaterialPlugin }
      )._noisePlugin;
      if (noisePluginRed) noisePluginRed.time = this.noiseTime;
    }
    if (this.pool.projMatTrapped) {
      const noisePlugin = (
        this.pool.projMatTrapped as BABYLON.PBRMaterial & { _noisePlugin?: SilkMaterialPlugin }
      )._noisePlugin;
      if (noisePlugin) noisePlugin.time = this.noiseTime;
    }

    const wAI = this.context.stores
      .get<WeaverAIComponent>("weaverAI")
      .get(this.context.refs.weaver);
    const currentScrollSpeed = this.context.runtime.currentScrollSpeed;
    const isPatrolling = wAI ? wAI.state === "PATROLLING" : true;

    for (const projId of this.pool.getEntities()) {
      const p = projStore.get(projId);
      if (!p || !p.isActive) continue;

      p.lifeTime += dt;

      const trans = transformStore.get(projId);
      const mesh = this.pool.getMesh(projId);
      if (!trans || !mesh) continue;

      if (p.isStuckToBug && p.stickyEntityId !== undefined) {
        const bugTrans = transformStore.get(p.stickyEntityId);
        if (bugTrans) {
          trans.x = bugTrans.x + (p.stickyOffsetX || 0);
          trans.y = bugTrans.y + (p.stickyOffsetY || 0);
          trans.prevX = trans.x;
          trans.prevY = trans.y;
          mesh.position.set(trans.x, trans.y, trans.z);
          const body = this.pool.getBody(projId);
          if (body) {
            this._scratchPos.set(trans.x, trans.y, trans.z);
            this._scratchRot.set(trans.qx, trans.qy, trans.qz, trans.qw);
            body.setTargetTransform(this._scratchPos, this._scratchRot);
          }
        } else {
          this.pool.release(projId);
        }
        continue;
      }

      if (!p.isStuck && !p.isTrappingPlayer && !p.isCharging) {
        const hBugStore = this.context.stores.get<HealthBugComponent>("healthBug");
        if (hBugStore) {
          let hitRedBug = false;
          for (const [hBugId, hBug] of hBugStore.entries()) {
            if (hBug.isWebTrapped || hBug.state === "DEAD") continue;
            const hBugTrans = transformStore.get(hBugId);
            if (!hBugTrans) continue;

            const dx = trans.x - hBugTrans.x;
            const dy = trans.y - hBugTrans.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const combinedRadius = 0.9 + 2.0;

            if (dist < combinedRadius) {
              if (p.isRed) {
                hBug.state = "DEAD";
                hitRedBug = true;
              } else {
                hBug.isWebTrapped = true;
                hBug.stuckToProjectileId = projId;
              }
              break;
            }
          }
          if (hitRedBug) {
            this.pool.release(projId);
            continue;
          }
        }

        const bugStore = this.context.stores.get<WallBugComponent>("wallBug");
        if (bugStore) {
          let hitRegistered = false;
          for (const [bugId, bug] of bugStore.entries()) {
            const bugTrans = transformStore.get(bugId);
            if (!bugTrans) continue;

            const halfW = bug.width / 2;
            const halfH = bug.height / 2;
            const projRadius = 0.9;

            const overlapX = Math.abs(trans.x - bugTrans.x) <= halfW + projRadius;
            const overlapY = Math.abs(trans.y - bugTrans.y) <= halfH + projRadius;

            if (overlapX && overlapY) {
              const hitLeft = trans.x < bugTrans.x;
              const hitRight = trans.x > bugTrans.x;

              if (
                (bug.spikedSide === "LEFT" && hitLeft) ||
                (bug.spikedSide === "RIGHT" && hitRight)
              ) {
                bug.spikesDisarmed = true;
              }

              p.isStuck = true;
              p.isStuckToBug = true;
              p.stickyEntityId = bugId;
              p.stickyOffsetX = hitLeft ? -halfW : halfW;
              p.stickyOffsetY = trans.y - bugTrans.y;

              const vel = this.context.stores
                .get<KinematicVelocityComponent>("velocity")
                .get(projId);
              if (vel) {
                vel.x = 0;
                vel.y = 0;
              }

              trans.qx = 0;
              trans.qy = 0;
              trans.qz = 0;
              trans.qw = 1;
              trans.prevQx = 0;
              trans.prevQy = 0;
              trans.prevQz = 0;
              trans.prevQw = 1;

              if (mesh.rotationQuaternion) {
                mesh.rotationQuaternion.set(0, 0, 0, 1);
              }

              trans.scaleX = 0.24;
              trans.scaleY = 1.45;
              trans.scaleZ = 1.45;
              mesh.scaling.set(0.24, 1.45, 1.45);

              const stuckMat = mesh.getScene().getMaterialByName("projectileMatStuck");
              if (stuckMat) {
                mesh.material = stuckMat;
              }

              this.context.broker.publish(GameEvent.PROJECTILE_IMPACT, {
                x: trans.x,
                y: trans.y,
                isWall: false
              });

              hitRegistered = true;
              break;
            }
          }
          if (hitRegistered) continue;
        }
      }

      if (p.isTrappingPlayer) {
        const pTrans = transformStore.get(this.context.refs.player);
        const pTrav = this.context.stores
          .get<TraversalStateComponent>("traversal")
          .get(this.context.refs.player);

        if (!pTrav || !pTrav.isWebTrapped || !pTrans) {
          this.pool.release(projId);
          continue;
        }

        const start = VISUAL_JUICE_CONFIG.COCOON_COLORS.DECAY_START;
        const mid = VISUAL_JUICE_CONFIG.COCOON_COLORS.DECAY_MID;
        const end = VISUAL_JUICE_CONFIG.COCOON_COLORS.DECAY_END;

        const escProgress = pTrav.escapeProgress || 0;
        const escRequired = pTrav.escapeRequired || 5;
        const progressRatio = Math.max(0, Math.min(1.0, escProgress / escRequired));

        let rVal: number, gVal: number, bVal: number;

        if (progressRatio >= 1.0) {
          rVal = 0.0;
          gVal = 0.0;
          bVal = 0.0;
        } else if (progressRatio < 0.5) {
          const t = progressRatio / 0.5;
          rVal = start.r + (mid.r - start.r) * t;
          gVal = start.g + (mid.g - start.g) * t;
          bVal = start.b + (mid.b - start.b) * t;
        } else {
          const t = (progressRatio - 0.5) / 0.5;
          rVal = mid.r + (end.r - mid.r) * t;
          gVal = mid.g + (end.g - mid.g) * t;
          bVal = mid.b + (end.b - mid.b) * t;
        }

        if (this.pool.projMatTrapped) {
          this.pool.projMatTrapped.albedoColor.set(rVal, gVal, bVal);
          this.pool.projMatTrapped.emissiveColor.set(rVal * 0.18, gVal * 0.18, bVal * 0.18);
        }

        const addedSize = Math.min(10.0, ((pTrav.webMass || 1) - 1) * 1.2);

        let targetScaleX = 1.0 + addedSize;
        let targetScaleY = 1.15 + addedSize;
        let targetScaleZ = 1.0 + addedSize;

        if (pTrav.state === "WALL_STICKING") {
          trans.qx = 0;
          trans.qy = 0;
          trans.qz = 0;
          trans.qw = 1;
          trans.prevQx = 0;
          trans.prevQy = 0;
          trans.prevQz = 0;
          trans.prevQw = 1;

          if (!mesh.rotationQuaternion) mesh.rotationQuaternion = new BABYLON.Quaternion();
          mesh.rotationQuaternion.set(0, 0, 0, 1);

          targetScaleX = 0.28 + addedSize * 0.28;
          targetScaleY = 2.0 + addedSize;
          targetScaleZ = 2.0 + addedSize;

          const wallOffset = pTrav.wallDir * 0.25;
          trans.x = pTrans.x + wallOffset;
          trans.y = pTrans.y;
          trans.z = pTrans.z;
          trans.prevX = pTrans.prevX + wallOffset;
          trans.prevY = pTrans.prevY;
          trans.prevZ = pTrans.prevZ;

          if (mesh.material !== this.pool.projMatTrapped) {
            mesh.material = this.pool.projMatTrapped;
          }
        } else {
          trans.x = pTrans.x;
          trans.y = pTrans.y;
          trans.z = pTrans.z;
          trans.prevX = pTrans.prevX;
          trans.prevY = pTrans.prevY;
          trans.prevZ = pTrans.prevZ;
          trans.qx = pTrans.qx;
          trans.qy = pTrans.qy;
          trans.qz = pTrans.qz;
          trans.qw = pTrans.qw;
          trans.prevQx = pTrans.prevQx;
          trans.prevQy = pTrans.prevQy;
          trans.prevQz = pTrans.prevQz;
          trans.prevQw = pTrans.prevQw;

          if (!mesh.rotationQuaternion) mesh.rotationQuaternion = new BABYLON.Quaternion();
          mesh.rotationQuaternion.set(trans.qx, trans.qy, trans.qz, trans.qw);

          if (mesh.material !== this.pool.projMatTrapped) {
            mesh.material = this.pool.projMatTrapped;
          }
        }

        const stiffness = 180;
        const damping = 15;

        const dx = (trans.scaleX ?? 1.0) - targetScaleX;
        const ax = -stiffness * dx - damping * (trans.scaleVelX ?? 0);
        trans.scaleVelX = (trans.scaleVelX ?? 0) + ax * dt;
        trans.scaleX = (trans.scaleX ?? 1.0) + trans.scaleVelX * dt;

        const dy = (trans.scaleY ?? 1.0) - targetScaleY;
        const ay = -stiffness * dy - damping * (trans.scaleVelY ?? 0);
        trans.scaleVelY = (trans.scaleVelY ?? 0) + ay * dt;
        trans.scaleY = (trans.scaleY ?? 1.0) + trans.scaleVelY * dt;

        const dz = (trans.scaleZ ?? 1.0) - targetScaleZ;
        const az = -stiffness * dz - damping * (trans.scaleVelZ ?? 0);
        trans.scaleVelZ = (trans.scaleVelZ ?? 0) + az * dt;
        trans.scaleZ = (trans.scaleZ ?? 1.0) + trans.scaleVelZ * dt;

        mesh.position.set(trans.x, trans.y, trans.z);
        mesh.scaling.set(trans.scaleX, trans.scaleY, trans.scaleZ);

        const body = this.pool.getBody(projId);
        if (body) {
          this._scratchPos.set(trans.x, trans.y, trans.z);
          this._scratchRot.set(trans.qx, trans.qy, trans.qz, trans.qw);
          body.setTargetTransform(this._scratchPos, this._scratchRot);
        }
      } else if (p.isStuckOnWall) {
        trans.y -= currentScrollSpeed * dt;
        mesh.position.y = trans.y;
        const body = this.pool.getBody(projId);
        if (body) {
          body.setTargetTransform(
            mesh.position,
            mesh.rotationQuaternion || BABYLON.Quaternion.Identity()
          );
        }
      } else if (p.isCharging) {
        if (!isPatrolling) {
          const reqStore = this.context.stores.get<ParticleRequestComponent>("particleRequest");
          if (reqStore) {
            const reqId = this.context.world.create();
            reqStore.add(reqId, {
              strategy: WEB_SPLAT_STRATEGY,
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

          this.pool.release(projId);
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

          if (!mesh.rotationQuaternion) mesh.rotationQuaternion = new BABYLON.Quaternion();
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

        const body = this.pool.getBody(projId);
        if (body) {
          this._scratchPos.set(trans.x, trans.y, trans.z);
          this._scratchRot.set(trans.qx, trans.qy, trans.qz, trans.qw);
          body.setTargetTransform(this._scratchPos, this._scratchRot);
        }
      } else {
        trans.prevScaleX = trans.scaleX;
        trans.prevScaleY = trans.scaleY;
        trans.prevScaleZ = trans.scaleZ;

        const vel = this.context.stores.get<KinematicVelocityComponent>("velocity").get(projId) || {
          x: 0,
          y: 0
        };
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

        if (speed > 0.1) {
          const angle = Math.atan2(vel.y, vel.x) - Math.PI / 2;
          if (!mesh.rotationQuaternion) mesh.rotationQuaternion = new BABYLON.Quaternion();
          BABYLON.Quaternion.RotationAxisToRef(BABYLON.Axis.Z, angle, mesh.rotationQuaternion);
          trans.qx = mesh.rotationQuaternion.x;
          trans.qy = mesh.rotationQuaternion.y;
          trans.qz = mesh.rotationQuaternion.z;
          trans.qw = mesh.rotationQuaternion.w;
        }

        const baseScale = 0.85;
        const stretchAmount = Math.min(1.8, speed * 0.045);
        trans.scaleX = baseScale * Math.max(0.3, 1.0 - stretchAmount * 0.35);
        trans.scaleY = baseScale * (1.0 + stretchAmount);
        trans.scaleZ = baseScale * Math.max(0.3, 1.0 - stretchAmount * 0.35);

        mesh.position.set(trans.x, trans.y, trans.z);
        mesh.scaling.set(trans.scaleX, trans.scaleY, trans.scaleZ);

        const body = this.pool.getBody(projId);
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
        this.pool.release(projId);
      }
    }
  }

  public dispose(): void {
    this._tracker.clear();
    if (this.pool) this.pool.dispose();
  }
}
