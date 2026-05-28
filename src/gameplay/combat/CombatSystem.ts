import { getDistance2D } from "../../core/utils/EngineUtils";
import { ARENA_CONFIG, GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import {
  TransformComponent,
  WeaverAIComponent,
  TetherComponent,
  TraversalStateComponent,
  KinematicTargetComponent,
  InvulnerabilityComponent,
  KinematicVelocityComponent
} from "../../core/ecs/Components";
import { SystemContext } from "../../core/engine/SystemContext";
import { GameEvent } from "../../core/events/GameEvents";

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

    const dist = getDistance2D(pTrans.x, pTrans.y, wTrans.x, wTrans.y);
    const distSq = dist * dist;

    if (distSq > this.BROADPHASE_ENVELOPE) return;

    const isColliding = dist < this.COMBINED_RADIUS_THRESHOLD;
    if (!isColliding) return;

    const dx = pTrans.x - wTrans.x;
    const dy = pTrans.y - wTrans.y;

    const wAI = this.context.stores
      .get<WeaverAIComponent>("weaverAI")
      .get(this.context.refs.weaver);
    const tether = this.context.stores.get<TetherComponent>("tether").get(this.context.refs.player);
    const pTrav = this.context.stores
      .get<TraversalStateComponent>("traversal")
      .get(this.context.refs.player);
    const pIframe = this.context.stores
      .get<InvulnerabilityComponent>("iframe")
      .get(this.context.refs.player);
    const pVel = this.context.stores
      .get<KinematicVelocityComponent>("velocity")
      .get(this.context.refs.player);

    if (!wAI || !tether || !pTrav || !pIframe || !pVel) return;

    const tuning = GAMEPLAY_TUNING.COMBAT;

    if (pTrav.state === "LAUNCHING" && pTrav.launchPower >= tuning.FLING_DAMAGE_THRESHOLD) {
      this.context.commands.dispatch({
        type: "DAMAGE_REQUEST",
        targetId: this.context.refs.weaver,
        amount: tuning.PLAYER_FLING_DAMAGE,
        source: "PLAYER_FLING"
      });

      this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
        amplitude: 1.4,
        duration: 0.55,
        dirX: dx / dist,
        dirY: dy / dist
      });

      pVel.x = (dx / dist) * tuning.REBOUND_FORCE;
      pVel.y = (dy / dist) * tuning.REBOUND_FORCE;
      pTrav.state = "AIRBORNE";
      pTrav.launchPower = 0;
      pTrav.launchTimer = 0;
      return;
    }

    const weaverIsHostile = wAI.state === "STRIKING";
    if (pIframe.timeRemaining <= 0 && weaverIsHostile) {
      const kbX = (dx / dist) * tuning.KNOCKBACK_FORCE_X;
      const kbY = (dy / dist) * tuning.KNOCKBACK_FORCE_Y + tuning.KNOCKBACK_BONUS_Y;

      this.context.commands.dispatch({
        type: "DAMAGE_REQUEST",
        targetId: this.context.refs.player,
        amount: tuning.WEAVER_CONTACT_DAMAGE,
        source: "WEAVER",
        knockbackX: kbX,
        knockbackY: kbY
      });

      this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
        amplitude: 0.5,
        duration: 0.3,
        dirX: dx / dist,
        dirY: dy / dist
      });
      return;
    }

    if (dist < this.COMBINED_RADIUS_THRESHOLD) {
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
    }
  }
}
