import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { WardenAIComponent, TransformComponent, WardenTraversalComponent, HealthComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { CommandBus } from "../../core/commands/CommandBus";
import { IWardenState, AIContext, WardenStateType } from "../states/IWardenState";
import { WardenSweepingState, WardenDashingState, WardenReturningState, WardenDefeatedState } from "../states/WardenStates";

export class WardenBrainSystem implements ISystem {
  readonly phase = SystemPhase.Intents;
  private states = new Map<WardenStateType, IWardenState>();
  private activeState: IWardenState | null = null;
  private contextCache: AIContext | null = null;
  private unsubDamage: (() => void) | null = null;

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
    this.states.set("DASHING", new WardenDashingState());
    this.states.set("RETURNING", new WardenReturningState());
    this.states.set("DEFEATED", new WardenDefeatedState());
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

    this.unsubDamage = this.broker.subscribe(GameEvent.WARDEN_DAMAGED, () => {
      const aiComp = this.ai.get(this.refs.warden);
      const health = this.healths.get(this.refs.warden);
      if (aiComp && health) {
        if (health.current <= 0) {
          this.transitionTo("DEFEATED");
        } else if (aiComp.state === "SWEEPING") {
          this.transitionTo("DASHING");
        }
      }
    });
  }

  private transitionTo(nextStateKey: WardenStateType): void {
    const aiComp = this.ai.get(this.refs.warden);
    if (!aiComp || !this.contextCache || !this.activeState) return;

    const nextStateObj = this.states.get(nextStateKey);
    if (nextStateObj && nextStateKey !== this.activeState.type) {
      this.activeState.exit(this.contextCache);
      
      aiComp.state = nextStateObj.type;
      aiComp.hue = nextStateObj.hue;
      aiComp.timeInState = 0;

      this.activeState = nextStateObj;
      this.activeState.enter(this.contextCache);

      this.broker.publish(GameEvent.WARDEN_STATE_CHANGE, { 
        state: nextStateObj.name, 
        hue: nextStateObj.hue 
      });
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
      this.transitionTo(nextStateKey);
    }
  }

  public dispose(): void {
    if (this.unsubDamage) {
      this.unsubDamage();
    }
  }
}
