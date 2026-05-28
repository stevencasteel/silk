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
          type: isPlayer ? "PLAYER_SPARK" : "WEAVER_SPARK",
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

      this.context.broker.publish(GameEvent.PLAYER_DAMAGED, {
        amount: cmd.amount,
        source: cmd.source
      });
      this.context.broker.publish(GameEvent.PLAYER_HEALTH_CHANGED, {
        hp: health.current,
        maxHp: health.max
      });

      if (health.current <= 0) {
        this.context.broker.publish(GameEvent.PLAYER_DIED, undefined);
      }
    } else {
      health.current = Math.max(0, health.current - cmd.amount);

      this.context.broker.publish(GameEvent.WEAVER_DAMAGED, {
        amount: cmd.amount,
        source: cmd.source
      });
      this.context.broker.publish(GameEvent.WEAVER_HEALTH_CHANGED, {
        hp: health.current,
        maxHp: health.max
      });

      if (health.current <= 0) {
        this.context.broker.publish(GameEvent.WEAVER_DIED, undefined);
      }
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
