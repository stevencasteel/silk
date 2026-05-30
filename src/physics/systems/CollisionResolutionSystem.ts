import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { getDistance2D } from "../../core/utils/EngineUtils";
import {
  TransformComponent,
  ProjectileComponent,
  HitboxComponent,
  HurtboxComponent,
  CollisionResponseComponent,
  HealthBugComponent,
  TraversalStateComponent
} from "../../core/ecs/Components";
import * as BABYLON from "@babylonjs/core";

export class CollisionResolutionSystem implements ISystem {
  readonly phase = SystemPhase.Collision;

  constructor(private context: SystemContext) {}

  public update(dt: number): void {
    void dt;
    const transforms = this.context.stores.get<TransformComponent>("transform");
    const responses = this.context.stores.get<CollisionResponseComponent>("collisionResponse");

    const hitboxes = this.context.stores.get<HitboxComponent>("hitbox");
    const hurtboxes = this.context.stores.get<HurtboxComponent>("hurtbox");

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

          const response = responses.get(hubId);
          if (response && response.onHit) {
            response.onHit(hb.damage, "PLAYER_FLING", dx / len, dy / len, this.context);
          }
        }
      }
    }

    const projectiles = this.context.stores.get<ProjectileComponent>("projectile");
    for (const [projId, pComp] of projectiles.entries()) {
      if (!pComp.isActive || pComp.isStuckOnWall) continue;

      const response = responses.get(projId);
      if (response && response.layer === "PROJECTILE" && response.onOverlap) {
        const mesh = this.context.visualQuery.getTransformNode(projId);
        const pMesh = this.context.visualQuery.getTransformNode(this.context.refs.player);

        if (
          mesh instanceof BABYLON.AbstractMesh &&
          pMesh instanceof BABYLON.AbstractMesh &&
          mesh.intersectsMesh(pMesh, false)
        ) {
          response.onOverlap(this.context.refs.player, this.context);
        }
      }
    }

    for (const [resId, response] of responses.entries()) {
      if (response.layer === "HAZARD" && response.onOverlap) {
        const playerTrans = transforms.get(this.context.refs.player);
        const hazardTrans = transforms.get(resId);
        if (playerTrans && hazardTrans) {
          const travStore = this.context.stores.get<TraversalStateComponent>("traversal");
          const pTrav = travStore ? travStore.get(this.context.refs.player) : undefined;
          if (pTrav && pTrav.lastStickyEntityId === resId) {
            continue;
          }
          
          const dist = getDistance2D(playerTrans.x, playerTrans.y, hazardTrans.x, hazardTrans.y);
          
          let combinedRadius = 2.4;
          const hBugStore = this.context.stores.get<HealthBugComponent>("healthBug");
          const hBug = hBugStore ? hBugStore.get(resId) : undefined;
          if (hBug && hBug.variant !== "NORMAL" && !hBug.spikesDisarmed) {
            combinedRadius = 3.4;
          }
          
          if (dist < combinedRadius) {
            response.onOverlap(this.context.refs.player, this.context);
          }
        }
      }
    }
  }
}
