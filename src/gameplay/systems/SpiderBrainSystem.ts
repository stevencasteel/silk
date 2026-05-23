import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { SpiderAIComponent, TransformComponent, SpiderTraversalComponent, HealthComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { CommandBus } from "../../core/commands/CommandBus";
import { ISpiderState, AIContext, SpiderStateType } from "../states/ISpiderState";
import { SpiderSweepingState, SpiderDashingState, SpiderReturningState, SpiderDefeatedState } from "../states/SpiderStates";

export class SpiderBrainSystem implements ISystem {
  readonly phase = SystemPhase.Intents;
  private states = new Map<SpiderStateType, ISpiderState>();
  private activeState: ISpiderState | null = null;
  private contextCache: AIContext | null = null;
  private unsubDamage: (() => void) | null = null;

  constructor(
    private refs: EntityRefs,
    private ai: ComponentStore<SpiderAIComponent>,
    private transforms: ComponentStore<TransformComponent>,
    private spiderTraversal: ComponentStore<SpiderTraversalComponent>,
    private healths: ComponentStore<HealthComponent>,
    private broker: EventBroker,
    private commands: CommandBus
  ) {
    this.states.set("SWEEPING", new SpiderSweepingState());
    this.states.set("DASHING", new SpiderDashingState());
    this.states.set("RETURNING", new SpiderReturningState());
    this.states.set("DEFEATED", new SpiderDefeatedState());
  }

  public init(): void {
    const aiComp = this.ai.get(this.refs.spider);
    if (aiComp) {
      const startState = aiComp.state as SpiderStateType;
      const stateObj = this.states.get(startState) || this.states.get("SWEEPING")!;
      
      aiComp.state = stateObj.type;
      aiComp.hue = stateObj.hue;
      aiComp.timeInState = 0;
      
      this.activeState = stateObj;
      
      this.contextCache = {
        spiderId: this.refs.spider,
        playerId: this.refs.player,
        ai: aiComp,
        transforms: this.transforms,
        spiderTraversal: this.spiderTraversal,
        healths: this.healths,
        commands: this.commands,
        broker: this.broker
      };

      this.activeState.enter(this.contextCache);
      this.publishStateChangeEvent(stateObj.name, stateObj.hue);
    }

    this.unsubDamage = this.broker.subscribe(GameEvent.SPIDER_DAMAGED, () => {
      const aiComp = this.ai.get(this.refs.spider);
      const health = this.healths.get(this.refs.spider);
      if (aiComp && health) {
        if (health.current <= 0) {
          this.transitionTo("DEFEATED");
        } else if (aiComp.state === "SWEEPING") {
          this.transitionTo("DASHING");
        }
      }
    });
  }

  private publishStateChangeEvent(name: string, hue: string): void {
    const health = this.healths.get(this.refs.spider);
    const isBerserk = health ? (health.current < health.max * 0.5) : false;
    let finalName = name;
    if (isBerserk && this.activeState?.type !== "DEFEATED") {
      finalName = `${name} (BERSERK)`;
    }
    this.broker.publish(GameEvent.SPIDER_STATE_CHANGE, { 
      state: finalName, 
      hue: hue 
    });
  }

  private transitionTo(nextStateKey: SpiderStateType): void {
    const aiComp = this.ai.get(this.refs.spider);
    if (!aiComp || !this.contextCache || !this.activeState) return;

    const nextStateObj = this.states.get(nextStateKey);
    if (nextStateObj && nextStateKey !== this.activeState.type) {
      this.activeState.exit(this.contextCache);
      
      aiComp.state = nextStateObj.type;
      aiComp.hue = nextStateObj.hue;
      aiComp.timeInState = 0;

      this.activeState = nextStateObj;
      this.activeState.enter(this.contextCache);

      this.publishStateChangeEvent(nextStateObj.name, nextStateObj.hue);
    }
  }

  public update(dt: number): void {
    const aiComp = this.ai.get(this.refs.spider);
    if (!aiComp || !this.activeState) return;

    if (!this.contextCache) {
      this.contextCache = {
        spiderId: this.refs.spider,
        playerId: this.refs.player,
        ai: aiComp,
        transforms: this.transforms,
        spiderTraversal: this.spiderTraversal,
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
