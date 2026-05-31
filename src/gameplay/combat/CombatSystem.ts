import { getDistance2D } from "../../core/utils/EngineUtils";
import { ARENA_CONFIG, GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { GameEvent } from "../../core/events/GameEvents";
import {
  TransformComponent,
  WeaverAIComponent,
  TraversalStateComponent,
  KinematicTargetComponent,
  KinematicVelocityComponent,
  HitboxComponent
} from "../../core/ecs/Components";
import { SystemContext } from "../../core/engine/SystemContext";

export class CombatSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;
  private readonly COMBINED_RADIUS_THRESHOLD =
    ARENA_CONFIG.ENTITY.PLAYER_RADIUS + ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
  private readonly BROADPHASE_ENVELOPE =
    (ARENA_CONFIG.ENTITY.PLAYER_RADIUS +
      ARENA_CONFIG.ENTITY.WEAVER_RADIUS +
      GAMEPLAY_TUNING.COMBAT.BROADPHASE_MARGIN) *
    (ARENA_CONFIG.ENTITY.PLAYER_RADIUS +
      ARENA_CONFIG.ENTITY.WEAVER_RADIUS +
      GAMEPLAY_TUNING.COMBAT.BROADPHASE_MARGIN);

  constructor(private context: SystemContext) {}

  public update(): void {
    const transforms = this.context.stores.get<TransformComponent>("transform");
    const pTrans = transforms.get(this.context.refs.player);
    const wTrans = transforms.get(this.context.refs.weaver);
    if (!pTrans || !wTrans) return;

    const hitboxes = this.context.stores.get<HitboxComponent>("hitbox");
    const pHb = hitboxes.get(this.context.refs.player);
    const wHb = hitboxes.get(this.context.refs.weaver);

    const wAI = this.context.stores
      .get<WeaverAIComponent>("weaverAI")
      .get(this.context.refs.weaver);
    const pTrav = this.context.stores
      .get<TraversalStateComponent>("traversal")
      .get(this.context.refs.player);

    const tuning = GAMEPLAY_TUNING.COMBAT;

    if (pHb && pTrav) {
      pHb.isActive = pTrav.state === "LAUNCHING" && pTrav.launchPower > 0.80;
    }
    if (wHb && wAI) {
      wHb.isActive = wAI.state === "STRIKING" && wAI.isThrusting === true;
    }

    let dist = getDistance2D(pTrans.x, pTrans.y, wTrans.x, wTrans.y);
    const distSq = dist * dist;

    if (distSq > this.BROADPHASE_ENVELOPE) return;

    const isColliding = dist < this.COMBINED_RADIUS_THRESHOLD;
    if (!isColliding) return;

    let dx = pTrans.x - wTrans.x;
    let dy = pTrans.y - wTrans.y;

    if (dist < 0.001) {
      const angle = Math.random() * Math.PI * 2.0;
      dx = Math.cos(angle) * 0.001;
      dy = Math.sin(angle) * 0.001;
      dist = 0.001;
    }

    const pVel = this.context.stores
      .get<KinematicVelocityComponent>("velocity")
      .get(this.context.refs.player);

    if (!pVel) return;

    const pActiveDamage = pHb ? pHb.isActive : false;
    const wActiveDamage = wHb ? wHb.isActive : false;

    if (!pActiveDamage && !wActiveDamage) {
      const overlap = this.COMBINED_RADIUS_THRESHOLD - dist;
      const nx = dx / dist;
      const ny = dy / dist;
      const shiftX = nx * overlap;
      const shiftY = ny * overlap;

      pTrans.x += shiftX;
      pTrans.y += shiftY;
      pTrans.prevX += shiftX;
      pTrans.prevY += shiftY;

      const pTarget = this.context.stores
        .get<KinematicTargetComponent>("target")
        .get(this.context.refs.player);
      if (pTarget) {
        pTarget.x += shiftX;
        pTarget.y += shiftY;
      }

      const dot = pVel.x * nx + pVel.y * ny;
      if (dot < 0) {
        pVel.x -= dot * nx * tuning.BOUNCE_ELASTICITY_MULT;
        pVel.y -= dot * ny * tuning.BOUNCE_ELASTICITY_MULT;
      }

      if (wAI && wAI.state === "PATROLLING") {
        this.context.broker.publish(GameEvent.WEAVER_BOUNCED, undefined);
      }
    }
  }
}
