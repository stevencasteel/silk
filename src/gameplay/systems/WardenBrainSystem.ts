import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { WardenAIComponent, TransformComponent, WardenTraversalComponent, HealthComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { CommandBus } from "../../core/commands/CommandBus";
import { IWardenState, AIContext, WardenStateType } from "../states/IWardenState";
import { WardenDormantState } from "../states/WardenDormantState";
import { WardenHuntingState } from "../states/WardenHuntingState";
import { WardenChargePrepState } from "../states/WardenChargePrepState";
import { WardenChargeAttackState } from "../states/WardenChargeAttackState";
import { WardenRecoveryState } from "../states/WardenRecoveryState";
import { WardenFakeDeathState } from "../states/WardenFakeDeathState";
import { WardenFinalPhaseState } from "../states/WardenFinalPhaseState";

export class WardenSweepingState implements IWardenState {
  public readonly type: WardenStateType = "SWEEPING";
  public readonly name = "SWEEPING CEILING";
  public readonly hue = "#ef4444";

  public enter(ctx: AIContext): void {
    ctx.ai.timeInState = 0;
    ctx.commands.dispatch({
      type: "SET_KINEMATIC_VELOCITY",
      entityId: ctx.wardenId,
      x: 4.5,
      y: 0,
      z: 0
    });
  }

  public exit(_ctx: AIContext): void {}

  public update(ctx: AIContext, dt: number): WardenStateType | null {
    ctx.ai.timeInState += dt;
    return ctx.ai.timeInState > 4.0 ? "DORMANT" : null;
  }
}

export class WardenBrainSystem implements ISystem {
  readonly phase = SystemPhase.Intents;
  private states = new Map<WardenStateType, IWardenState>();
  private activeState: IWardenState | null = null;
  private contextCache: AIContext | null = null;

  constructor(
    private refs: EntityRefs,
    private ai: ComponentStore<WardenAIComponent>,
    private transforms: ComponentStore<TransformComponent>,
    private wardenTraversal: ComponentStore<WardenTraversalComponent>,
    private healths: ComponentStore<HealthComponent>,
    private broker: EventBroker,
    private commands: CommandBus
  ) {
    this.states.set("SWEEPING", new WardenSweepingState());
    this.states.set("DORMANT", new WardenDormantState());
    this.states.set("HUNTING", new WardenHuntingState());
    this.states.set("CHARGE_PREP", new WardenChargePrepState());
    this.states.set("CHARGE_ATTACK", new WardenChargeAttackState());
    this.states.set("RECOVERY", new WardenRecoveryState());
    this.states.set("FAKE_DEATH", new WardenFakeDeathState());
    this.states.set("FINAL_PHASE", new WardenFinalPhaseState());
  }

  public init(): void {
    const aiComp = this.ai.get(this.refs.warden);
    if (aiComp) {
      const startState = aiComp.state as WardenStateType;
      const stateObj = this.states.get(startState) || this.states.get("SWEEPING")!;
      
      aiComp.state = stateObj.type;
      aiComp.hue = stateObj.hue;
      aiComp.timeInState = 0;
      
      this.activeState = stateObj;
      
      this.contextCache = {
        wardenId: this.refs.warden,
        playerId: this.refs.player,
        ai: aiComp,
        transforms: this.transforms,
        wardenTraversal: this.wardenTraversal,
        healths: this.healths,
        commands: this.commands,
        broker: this.broker
      };

      this.activeState.enter(this.contextCache);
      this.broker.publish(GameEvent.WARDEN_STATE_CHANGE, { state: stateObj.name, hue: stateObj.hue });
    }
  }

  public update(dt: number): void {
    const aiComp = this.ai.get(this.refs.warden);
    if (!aiComp || !this.activeState) return;

    if (!this.contextCache) {
      this.contextCache = {
        wardenId: this.refs.warden,
        playerId: this.refs.player,
        ai: aiComp,
        transforms: this.transforms,
        wardenTraversal: this.wardenTraversal,
        healths: this.healths,
        commands: this.commands,
        broker: this.broker
      };
    }

    const nextStateKey = this.activeState.update(this.contextCache, dt);

    if (nextStateKey && nextStateKey !== this.activeState.type) {
      const nextStateObj = this.states.get(nextStateKey);
      if (nextStateObj) {
        this.activeState.exit(this.contextCache);
        
        aiComp.state = nextStateObj.type;
        aiComp.hue = nextStateObj.hue;
        aiComp.timeInState = 0;
        
        if (nextStateKey === "FAKE_DEATH") {
          aiComp.hasFakedDeath = true;
        }

        this.activeState = nextStateObj;
        this.activeState.enter(this.contextCache);

        this.broker.publish(GameEvent.WARDEN_STATE_CHANGE, { 
          state: nextStateObj.name, 
          hue: nextStateObj.hue 
        });
      }
    }
  }
}
