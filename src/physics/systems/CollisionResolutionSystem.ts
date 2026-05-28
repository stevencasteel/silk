import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { getDistance2D } from "../../core/utils/EngineUtils";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
  TransformComponent,
  CollisionStateComponent,
  ProjectileComponent,
  HitboxComponent,
  HurtboxComponent,
  InvulnerabilityComponent,
  TraversalStateComponent,
  HealthComponent,
  KinematicVelocityComponent
} from "../../core/ecs/Components";
import { ARENA_CONFIG, GAMEPLAY_TUNING, WEAVER_AI_TUNING } from "../../core/engine/ArenaConfig";
import { GameEvent } from "../../core/events/GameEvents";
import * as BABYLON from "@babylonjs/core";

export class CollisionResolutionSystem implements ISystem {
  readonly phase = SystemPhase.Collision;
  private readonly WALL_LIMIT_X = ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;

  constructor(private context: SystemContext) {}

  public update(dt: number): void {
    void dt;
    const transforms = this.context.stores.get<TransformComponent>("transform");
    const collisionStore = this.context.stores.get<CollisionStateComponent>("collisionState");

    for (const [id] of transforms.entries()) {
      if (!collisionStore.has(id)) {
        collisionStore.add(id, {
          isGrounded: false,
          isWallClinging: false,
          wallNormalX: 0,
          wallNormalY: 0,
          lastHitType: "NONE",
          hitPointX: 0,
          hitPointY: 0
        });
      }
    }

    const pId = this.context.refs.player;
    const pTrans = transforms.get(pId);
    const pCol = collisionStore.get(pId);
    if (pTrans && pCol) {
      const hitRight = pTrans.x > this.WALL_LIMIT_X;
      const hitLeft = pTrans.x < -this.WALL_LIMIT_X;

      if (hitRight) {
        pCol.isWallClinging = true;
        pCol.wallNormalX = -1;
        pCol.lastHitType = "WALL";
        pCol.hitPointX = this.WALL_LIMIT_X;
        pCol.hitPointY = pTrans.y;
      } else if (hitLeft) {
        pCol.isWallClinging = true;
        pCol.wallNormalX = 1;
        pCol.lastHitType = "WALL";
        pCol.hitPointX = -this.WALL_LIMIT_X;
        pCol.hitPointY = pTrans.y;
      } else {
        pCol.isWallClinging = false;
        pCol.wallNormalX = 0;
      }
    }

    const projectiles = this.context.stores.get<ProjectileComponent>("projectile");
    for (const [id, pComp] of projectiles.entries()) {
      if (!pComp.isActive || pComp.isStuck) continue;

      const projTrans = transforms.get(id);
      const projCol = collisionStore.get(id);
      if (projTrans && projCol) {
        const hitRight = projTrans.x >= this.WALL_LIMIT_X;
        const hitLeft = projTrans.x <= -this.WALL_LIMIT_X;

        if (hitRight || hitLeft) {
          pComp.isStuck = true;
          pComp.isStuckOnWall = true;
          projTrans.x = Math.sign(projTrans.x) * (this.WALL_LIMIT_X - 0.05);

          projCol.isWallClinging = true;
          projCol.wallNormalX = hitRight ? -1 : 1;
          projCol.lastHitType = "WALL";
          projCol.hitPointX = projTrans.x;
          projCol.hitPointY = projTrans.y;

          const mesh = this.context.visualRegistry.getTransformNode(id) as BABYLON.Mesh;
          if (mesh) {
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

    this.resolveProjectilePlayerCollisions(projectiles, transforms);

    const hitboxes = this.context.stores.get<HitboxComponent>("hitbox");
    const hurtboxes = this.context.stores.get<HurtboxComponent>("hurtbox");
    const iframes = this.context.stores.get<InvulnerabilityComponent>("iframe");

    for (const [hbId, hb] of hitboxes.entries()) {
      if (!hb.isActive) continue;

      const hbTrans = transforms.get(hbId);
      if (!hbTrans) continue;

      for (const [hubId, hub] of hurtboxes.entries()) {
        if (!hub.isActive || hb.ownerId === hub.ownerId) continue;

        if (hb.targetLayer !== "BOTH" && hb.targetLayer !== hub.layer) continue;

        const hubTrans = transforms.get(hubId);
        if (!hubTrans) continue;

        const dist = getDistance2D(hbTrans.x, hbTrans.y, hubTrans.x, hubTrans.y);
        const combinedRadius = hb.radius + hub.radius;

        if (dist < combinedRadius) {
          const dx = hubTrans.x - hbTrans.x;
          const dy = hubTrans.y - hbTrans.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1.0;

          if (hub.layer === "PLAYER") {
            const pIframe = iframes.get(hubId);
            if (pIframe && pIframe.timeRemaining <= 0) {
              const tuning = GAMEPLAY_TUNING.COMBAT;
              const kbX = (dx / len) * tuning.KNOCKBACK_FORCE_X;
              const kbY = (dy / len) * tuning.KNOCKBACK_FORCE_Y + tuning.KNOCKBACK_BONUS_Y;

              this.context.commands.dispatch({
                type: "DAMAGE_REQUEST",
                targetId: hubId,
                amount: hb.damage,
                source: "WEAVER",
                knockbackX: kbX,
                knockbackY: kbY
              });

              this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
                amplitude: 0.5,
                duration: 0.3,
                dirX: dx / len,
                dirY: dy / len
              });
            }
          } else if (hub.layer === "WEAVER") {
            const tuning = GAMEPLAY_TUNING.COMBAT;
            this.context.commands.dispatch({
              type: "DAMAGE_REQUEST",
              targetId: hubId,
              amount: hb.damage,
              source: "PLAYER_FLING"
            });

            this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
              amplitude: 1.4,
              duration: 0.55,
              dirX: dx / len,
              dirY: dy / len
            });

            this.context.commands.dispatch({
              type: "APPLY_IMPULSE",
              entityId: hb.ownerId,
              x: -(dx / len) * tuning.REBOUND_FORCE,
              y: -(dy / len) * tuning.REBOUND_FORCE,
              z: 0
            });

            const trav = this.context.stores.get<TraversalStateComponent>("traversal").get(hb.ownerId);
            if (trav) {
              trav.state = "AIRBORNE";
              trav.launchPower = 0;
              trav.launchTimer = 0;
            }
          }
        }
      }
    }
  }

  private resolveProjectilePlayerCollisions(
    projectiles: ComponentStore<ProjectileComponent>,
    transforms: ComponentStore<TransformComponent>
  ): void {
    const healthStore = this.context.stores.get<HealthComponent>("health");
    const iframeStore = this.context.stores.get<InvulnerabilityComponent>("iframe");
    const traversalStore = this.context.stores.get<TraversalStateComponent>("traversal");

    const pId = this.context.refs.player;
    const pHealth = healthStore.get(pId);
    const wHealth = healthStore.get(this.context.refs.weaver);
    const pIframe = iframeStore.get(pId);
    const pTrav = traversalStore.get(pId);

    if (!pHealth || !wHealth || !pIframe) return;
    if (pHealth.current <= 0 || wHealth.current <= 0) return;

    const pMesh = this.context.visualRegistry.getTransformNode(pId) as BABYLON.AbstractMesh;
    if (!pMesh) return;

    for (const [projId, pComp] of projectiles.entries()) {
      if (!pComp.isActive || pComp.isStuckOnWall) continue;

      const mesh = this.context.visualRegistry.getTransformNode(projId) as BABYLON.Mesh;
      const trans = transforms.get(projId);
      if (!mesh || !trans) continue;

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

          this.recycleProjectileInSystem(projId, pComp);
        } else if (!hasIframe) {
          this.context.commands.dispatch({
            type: "DAMAGE_REQUEST",
            targetId: pId,
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

          this.recycleProjectileInSystem(projId, pComp);
        }
      }
    }
  }

  private recycleProjectileInSystem(projId: number, p: ProjectileComponent): void {
    const systems = this.context.stores;
    const transformStore = systems.get<TransformComponent>("transform");
    const velocityStore = systems.get<KinematicVelocityComponent>("velocity");

    p.isActive = false;
    p.isStuck = false;
    p.isStuckOnWall = false;
    p.lifeTime = 0.0;
    p.fallbackX = 0.0;
    p.fallbackY = 0.0;

    const trans = transformStore.get(projId);
    const vel = velocityStore.get(projId);
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
      const activeMat = mesh.getScene().getMaterialByName("projectileMatActive");
      if (activeMat) {
        mesh.material = activeMat;
      }
    }
  }
}
