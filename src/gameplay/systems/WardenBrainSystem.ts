import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { WardenAIComponent, TransformComponent, WardenTraversalComponent, HealthComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { IWardenState, WardenStateType, AIContext } from "../states/IWardenState";
import { WardenDormantState } from "../states/WardenDormantState";
import { WardenHuntingState } from "../states/WardenHuntingState";
import { WardenChargePrepState } from "../states/WardenChargePrepState";
import { WardenChargeAttackState } from "../states/WardenChargeAttackState";
import { WardenRecoveryState } from "../states/WardenRecoveryState";
import { WardenFakeDeathState } from "../states/WardenFakeDeathState";
import { WardenFinalPhaseState } from "../states/WardenFinalPhaseState";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { CommandBus } from "../../core/commands/CommandBus";

export class WardenBrainSystem implements ISystem {
  readonly phase = SystemPhase.Intents;
  private currentState: IWardenState;
  private states: Map<WardenStateType, IWardenState> = new Map();
  private ctx: AIContext;
  private unsubReset: (() => void) | null = null;

  constructor(
    private refs: EntityRefs,
    private ai: ComponentStore<WardenAIComponent>,
    private transforms: ComponentStore<TransformComponent>,
    private wardenTraversal: ComponentStore<WardenTraversalComponent>,
    private healths: ComponentStore<HealthComponent>,
    private broker: EventBroker,
    private commands: CommandBus
  ) {
    this.states.set("DORMANT", new WardenDormantState());
    this.states.set("HUNTING", new WardenHuntingState());
    this.states.set("CHARGE_PREP", new WardenChargePrepState());
    this.states.set("CHARGE_ATTACK", new WardenChargeAttackState());
    this.states.set("RECOVERY", new WardenRecoveryState());
    this.states.set("FAKE_DEATH", new WardenFakeDeathState());
    this.states.set("FINAL_PHASE", new WardenFinalPhaseState());

    this.currentState = this.states.get("DORMANT") as IWardenState;
    this.ctx = { 
      wardenId: -1, 
      playerId: -1, 
      ai: null as any, 
      transforms: this.transforms, 
      wardenTraversal: this.wardenTraversal, 
      healths: this.healths,
      commands: this.commands, 
      broker: this.broker 
    };
  }

  public init(): void {
    this.ctx.wardenId = this.refs.warden;
    this.ctx.playerId = this.refs.player;
    this.ctx.ai = this.ai.get(this.refs.warden)!;
    this.currentState.enter(this.ctx);
    this.broker.publish(GameEvent.WARDEN_STATE_CHANGE, { state: this.currentState.name, hue: this.currentState.hue });

    this.unsubReset = this.broker.subscribe(GameEvent.GAME_RESET, () => {
      this.currentState = this.states.get("DORMANT") as IWardenState;
      this.ctx.ai = this.ai.get(this.refs.warden)!;
      this.currentState.enter(this.ctx);
      this.broker.publish(GameEvent.WARDEN_STATE_CHANGE, { state: this.currentState.name, hue: this.currentState.hue });
    });
  }

  public update(dt: number): void {
    if (!this.ctx.ai) this.ctx.ai = this.ai.get(this.refs.warden)!;

    const wHealth = this.healths.get(this.refs.warden);
    if (wHealth && wHealth.current <= 0 && !this.ctx.ai.hasFakedDeath && this.currentState.type !== "FAKE_DEATH" && this.currentState.type !== "FINAL_PHASE") {
      this.ctx.ai.hasFakedDeath = true;
      this.transitionTo("FAKE_DEATH");
      return;
    }

    const nextStateType = this.currentState.update(this.ctx, dt);
    if (nextStateType && nextStateType !== this.currentState.type) {
      this.transitionTo(nextStateType);
    }
  }

  private transitionTo(nextStateType: WardenStateType): void {
    this.currentState.exit(this.ctx);
    const nextState = this.states.get(nextStateType);
    if (!nextState) throw new Error(`Warden state not found: ${nextStateType}`);
    this.currentState = nextState;
    this.currentState.enter(this.ctx);
    this.ctx.ai.state = this.currentState.name;
    this.ctx.ai.hue = this.currentState.hue;
    this.broker.publish(GameEvent.WARDEN_STATE_CHANGE, { state: this.currentState.name, hue: this.currentState.hue });
  }

  public dispose(): void {
    if (this.unsubReset) this.unsubReset();
  }
}
