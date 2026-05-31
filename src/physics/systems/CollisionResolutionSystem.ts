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
import { GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";

export class CollisionResolutionSystem implements ISystem {
  readonly phase = SystemPhase.Collision;
  private currentTime = 0.0;

  constructor(private context: SystemContext) {}

  public update(dt: number): void {
    this.currentTime += dt;
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
          const cooldown = hb.hitCooldown || 0.1;
          
          if (hb.lastHitTime !== undefined && this.currentTime - hb.lastHitTime < cooldown) {
            continue;
          }

          let dx = hubTrans.x - hbTrans.x;
          let dy = hubTrans.y - hbTrans.y;
          let len = Math.sqrt(dx * dx + dy * dy);
          if (len < 0.001) {
            const angle = Math.random() * Math.PI * 2;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            len = 1.0;
          }

          const response = responses.get(hubId);
          if (response && response.onHit) {
            response.onHit(hb.damage, "PLAYER_FLING", dx / len, dy / len, this.context);
            hb.lastHitTime = this.currentTime;
          }
        }
      }
    }

    const projectiles = this.context.stores.get<ProjectileComponent>("projectile");
    for (const [projId, pComp] of projectiles.entries()) {
      if (!pComp.isActive || pComp.isStuckOnWall) continue;

      const response = responses.get(projId);
      if (response && response.layer === "PROJECTILE" && response.onOverlap) {
        const projTrans = transforms.get(projId);
        const playerTrans = transforms.get(this.context.refs.player);

        if (projTrans && playerTrans) {
          const projectileRadius = 0.9;
          const playerRadius = this.context.stores.get<HurtboxComponent>("hurtbox").get(this.context.refs.player)?.radius || 1.0;
          const combinedRadius = projectileRadius + playerRadius;

          const dist = getDistance2D(projTrans.x, projTrans.y, playerTrans.x, playerTrans.y);
          
          if (dist < combinedRadius) {
            response.onOverlap(this.context.refs.player, this.context);
          } else {
            const dx = projTrans.x - projTrans.prevX;
            const dy = projTrans.y - projTrans.prevY;
            const movementDist = Math.sqrt(dx * dx + dy * dy);
            
            if (movementDist > 0.01) {
              const t = this.closestPointOnSegment(
                projTrans.prevX, projTrans.prevY,
                projTrans.x, projTrans.y,
                playerTrans.x, playerTrans.y
              );
              
              const closestX = projTrans.prevX + dx * t;
              const closestY = projTrans.prevY + dy * t;
              const closestDist = getDistance2D(closestX, closestY, playerTrans.x, playerTrans.y);
              
              if (closestDist < combinedRadius) {
                response.onOverlap(this.context.refs.player, this.context);
              }
            }
          }
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

          let combinedRadius = GAMEPLAY_TUNING.COMBAT.HAZARD_COLLISION_RADIUS_NORMAL;
          const hBugStore = this.context.stores.get<HealthBugComponent>("healthBug");
          const hBug = hBugStore ? hBugStore.get(resId) : undefined;
          if (hBug && hBug.variant !== "NORMAL" && !hBug.spikesDisarmed) {
            combinedRadius = GAMEPLAY_TUNING.COMBAT.HAZARD_COLLISION_RADIUS_SPIKED;
          }

          if (dist < combinedRadius) {
            response.onOverlap(this.context.refs.player, this.context);
          }
        }
      }
    }
  }

  private closestPointOnSegment(
    x1: number, y1: number,
    x2: number, y2: number,
    px: number, py: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    
    if (lenSq < 0.0001) return 0;
    
    const t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    return Math.max(0, Math.min(1, t));
  }
}
