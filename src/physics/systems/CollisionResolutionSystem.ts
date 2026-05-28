import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { getDistance2D } from "../../core/utils/EngineUtils";
import {
  TransformComponent,
  CollisionStateComponent,
  ProjectileComponent,
  HitboxComponent,
  HurtboxComponent,
  InvulnerabilityComponent,
  TraversalStateComponent
} from "../../core/ecs/Components";
import { ARENA_CONFIG, GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";
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

    // Resolve component-driven Hitbox-to-Hurtbox overlaps
    const hitboxes = this.context.stores.get<HitboxComponent>("hitbox");
    const hurtboxes = this.context.stores.get<HurtboxComponent>("hurtbox");
    const iframes = this.context.stores.get<InvulnerabilityComponent>("iframe");

    for (const [hbId, hb] of hitboxes.entries()) {
      if (!hb.isActive) continue;

      const hbTrans = transforms.get(hbId);
      if (!hbTrans) continue;

      for (const [hubId, hub] of hurtboxes.entries()) {
        if (!hub.isActive || hb.ownerId === hub.ownerId) continue;

        // Verify layer alignment
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

            // Rebound player using command system
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
}
