import { ARENA_CONFIG, GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
  TransformComponent,
  HealthComponent,
  WeaverAIComponent,
  TetherComponent,
  InvulnerabilityComponent,
  TraversalStateComponent,
  KinematicTargetComponent
} from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { CommandBus } from "../../core/commands/CommandBus";
import { ApplyImpulseCommand } from "../../physics/commands/PhysicsCommands";

export class CombatSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;

  private readonly COMBINED_RADIUS_THRESHOLD = ARENA_CONFIG.ENTITY.PLAYER_RADIUS + ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
  private readonly BROADPHASE_ENVELOPE = 
    (ARENA_CONFIG.ENTITY.PLAYER_RADIUS + ARENA_CONFIG.ENTITY.WEAVER_RADIUS + GAMEPLAY_TUNING.COMBAT.BROADPHASE_MARGIN) * 
    (ARENA_CONFIG.ENTITY.PLAYER_RADIUS + ARENA_CONFIG.ENTITY.WEAVER_RADIUS + GAMEPLAY_TUNING.COMBAT.BROADPHASE_MARGIN);

  constructor(
    private refs: EntityRefs,
    private transforms: ComponentStore<TransformComponent>,
    private healths: ComponentStore<HealthComponent>,
    private weaverAIs: ComponentStore<WeaverAIComponent>,
    private tethers: ComponentStore<TetherComponent>,
    private iframes: ComponentStore<InvulnerabilityComponent>,
    private traversal: ComponentStore<TraversalStateComponent>,
    private broker: EventBroker,
    private commands: CommandBus,
    private targets: ComponentStore<KinematicTargetComponent>
  ) {}

  public update(dt: number): void {
    const pHealth = this.healths.get(this.refs.player);
    const wHealth = this.healths.get(this.refs.weaver);
    const wAI = this.weaverAIs.get(this.refs.weaver);
    const pIframe = this.iframes.get(this.refs.player);
    const tether = this.tethers.get(this.refs.player);
    const pTrav = this.traversal.get(this.refs.player);

    if (!pHealth || !wHealth || !wAI || !pIframe || !tether || !pTrav) return;

    if (pHealth.current <= 0 || wHealth.current <= 0) return;

    if (pIframe.timeRemaining > 0) {
      pIframe.timeRemaining -= dt;
    }

    const pTrans = this.transforms.get(this.refs.player);
    const wTrans = this.transforms.get(this.refs.weaver);
    if (!pTrans || !wTrans) return;

    const dx = pTrans.x - wTrans.x;
    const dy = pTrans.y - wTrans.y;
    const distSq = dx * dx + dy * dy;

    if (distSq > this.BROADPHASE_ENVELOPE) {
      return;
    }

    const dist = Math.sqrt(distSq) || 1.0;
    const isColliding = dist < this.COMBINED_RADIUS_THRESHOLD;
    if (!isColliding) return;

    const tuning = GAMEPLAY_TUNING.COMBAT;

    if (pTrav.state === "LAUNCHING" && pTrav.launchPower >= tuning.FLING_DAMAGE_THRESHOLD) {
      this.resolvePlayerFlingHit(wHealth, tether, pTrav, dx, dy, distSq);
      return;
    }

    const weaverIsHostile = wAI.state === "DASHING";

    if (pIframe.timeRemaining <= 0 && weaverIsHostile) {
      this.resolveWeaverContactHit(pHealth, pIframe, dx, dy, distSq);
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

      const pTarget = this.targets.get(this.refs.player);
      if (pTarget) {
        pTarget.x += shiftX;
        pTarget.y += shiftY;
      }

      const dot = tether.dynamicVelX * nx + tether.dynamicVelY * ny;
      if (dot < 0) {
        tether.dynamicVelX -= dot * nx * tuning.BOUNCE_ELASTICITY_MULT;
        tether.dynamicVelY -= dot * ny * tuning.BOUNCE_ELASTICITY_MULT;
      }
    }
  }

  private resolvePlayerFlingHit(
    wHealth: HealthComponent,
    tether: TetherComponent,
    pTrav: TraversalStateComponent,
    dx: number,
    dy: number,
    distSq: number
  ): void {
    const tuning = GAMEPLAY_TUNING.COMBAT;
    wHealth.current -= tuning.PLAYER_FLING_DAMAGE;

    this.broker.publish(GameEvent.WEAVER_DAMAGED, {
      amount: tuning.PLAYER_FLING_DAMAGE,
      source: "PLAYER_FLING"
    });

    this.broker.publish(GameEvent.WEAVER_HEALTH_CHANGED, {
      hp: Math.max(0, wHealth.current),
      maxHp: wHealth.max
    });

    this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 1.4, duration: 0.55 });

    const dist = Math.sqrt(distSq) || 1;
    tether.dynamicVelX = (dx / dist) * tuning.REBOUND_FORCE;
    tether.dynamicVelY = (dy / dist) * tuning.REBOUND_FORCE;
    pTrav.state = "AIRBORNE";
    pTrav.launchPower = 0;
    pTrav.launchTimer = 0;
  }

  private resolveWeaverContactHit(
    pHealth: HealthComponent,
    pIframe: InvulnerabilityComponent,
    dx: number,
    dy: number,
    distSq: number
  ): void {
    const tuning = GAMEPLAY_TUNING.COMBAT;
    pHealth.current -= tuning.WEAVER_CONTACT_DAMAGE;
    pIframe.timeRemaining = tuning.PLAYER_IFRAME_DURATION;

    const dist = Math.sqrt(distSq) || 1;
    this.commands.dispatch<ApplyImpulseCommand>({
      type: "APPLY_IMPULSE",
      entityId: this.refs.player,
      x: (dx / dist) * tuning.KNOCKBACK_FORCE_X,
      y: (dy / dist) * tuning.KNOCKBACK_FORCE_Y + tuning.KNOCKBACK_BONUS_Y,
      z: 0
    });

    this.broker.publish(GameEvent.PLAYER_DAMAGED, {
      amount: tuning.WEAVER_CONTACT_DAMAGE,
      source: "WEAVER"
    });
    this.broker.publish(GameEvent.PLAYER_HEALTH_CHANGED, {
      hp: pHealth.current,
      maxHp: pHealth.max
    });
    this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.5, duration: 0.3 });

    if (pHealth.current <= 0) {
      pHealth.current = 0;
      this.broker.publish(GameEvent.PLAYER_DIED, undefined);
    }
  }
}
