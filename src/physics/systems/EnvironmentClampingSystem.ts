import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  TransformComponent,
  CollisionStateComponent,
  ProjectileComponent
} from "../../core/ecs/Components";
import { ARENA_CONFIG } from "../../core/engine/ArenaConfig";
import { GameEvent } from "../../core/events/GameEvents";
import * as BABYLON from "@babylonjs/core";

export class EnvironmentClampingSystem implements ISystem {
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
  }
}
