import { PLAYER_SPARK_STRATEGY, WEAVER_SPARK_STRATEGY } from "../juice/ParticleStrategies";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  HealthComponent,
  InvulnerabilityComponent,
  TransformComponent,
  ParticleRequestComponent
} from "../../core/ecs/Components";
import { DamageRequestCommand } from "./CombatCommands";
import { GameEvent } from "../../core/events/GameEvents";
import { GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";

export class HealthSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;

  constructor(private context: SystemContext) {}

  public init(): void {
    this.context.commands.register<DamageRequestCommand>("DAMAGE_REQUEST", (cmd) => {
      this.handleDamageRequest(cmd);
    });
  }

  private handleDamageRequest(cmd: DamageRequestCommand): void {
    const healthStore = this.context.stores.get<HealthComponent>("health");
    const health = healthStore.get(cmd.targetId);
    if (!health || health.current <= 0) return;

    const isPlayer = cmd.targetId === this.context.refs.player;

    const transforms = this.context.stores.get<TransformComponent>("transform");
    const targetTrans = transforms.get(cmd.targetId);

    // Spawn purely decoupled visual request in ECS
    if (targetTrans) {
      const reqId = this.context.world.create();
      const requestStore = this.context.stores.get<ParticleRequestComponent>("particleRequest");
      if (requestStore) {
        requestStore.add(reqId, {
          strategy: isPlayer ? PLAYER_SPARK_STRATEGY : WEAVER_SPARK_STRATEGY,
          x: targetTrans.x,
          y: targetTrans.y,
          z: targetTrans.z
        });
      }
    }

    if (isPlayer) {
      const iframeStore = this.context.stores.get<InvulnerabilityComponent>("iframe");
      const iframe = iframeStore.get(cmd.targetId);
      if (iframe && iframe.timeRemaining > 0) {
        return;
      }

      health.current = Math.max(0, health.current - cmd.amount);

      if (iframe) {
        iframe.timeRemaining = GAMEPLAY_TUNING.COMBAT.PLAYER_IFRAME_DURATION;
      }

      if (cmd.knockbackX !== undefined && cmd.knockbackY !== undefined) {
        this.context.commands.dispatch({
          type: "APPLY_IMPULSE",
          entityId: cmd.targetId,
          x: cmd.knockbackX,
          y: cmd.knockbackY,
          z: 0
        });
      }

      this.publishDamageEvents(
        GameEvent.PLAYER_DAMAGED,
        GameEvent.PLAYER_HEALTH_CHANGED,
        GameEvent.PLAYER_DIED,
        cmd.amount,
        cmd.source,
        health.current,
        health.max
      );
    } else {
      health.current = Math.max(0, health.current - cmd.amount);

      this.publishDamageEvents(
        GameEvent.WEAVER_DAMAGED,
        GameEvent.WEAVER_HEALTH_CHANGED,
        GameEvent.WEAVER_DIED,
        cmd.amount,
        cmd.source,
        health.current,
        health.max
      );
    }
  }

  private publishDamageEvents(
    damagedEvent: GameEvent,
    healthChangedEvent: GameEvent,
    diedEvent: GameEvent,
    amount: number,
    source: string,
    currentHp: number,
    maxHp: number
  ): void {
    this.context.broker.publish(damagedEvent, { amount, source });
    this.context.broker.publish(healthChangedEvent, { hp: currentHp, maxHp });

    if (currentHp <= 0) {
      this.context.broker.publish(diedEvent, undefined);
    }
  }

  public update(dt: number): void {
    const iframeStore = this.context.stores.get<InvulnerabilityComponent>("iframe");
    const iframe = iframeStore.get(this.context.refs.player);
    if (iframe && iframe.timeRemaining > 0) {
      iframe.timeRemaining = Math.max(0, iframe.timeRemaining - dt);
    }
  }
}
