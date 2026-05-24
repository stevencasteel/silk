import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
  WeaverAIComponent,
  TransformComponent,
  WeaverTraversalComponent,
  HealthComponent
} from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { CommandBus } from "../../core/commands/CommandBus";
import { IWeaverState, AIContext, WeaverStateType } from "./IWeaverState";
import { WEAVER_AI_TUNING } from "../../core/engine/ArenaConfig";
import {
  WeaverSweepingState,
  WeaverDashingState,
  WeaverReturningState,
  WeaverDefeatedState
} from "./WeaverStates";

export class WeaverBrainSystem implements ISystem {
  readonly phase = SystemPhase.Intents;
  private states = new Map<WeaverStateType, IWeaverState>();
  private activeState: IWeaverState | null = null;
  private contextCache: AIContext | null = null;
  private unsubDamage: (() => void) | null = null;
  private unsubReset: (() => void) | null = null;
  private pendingTransition: WeaverStateType | null = null;

  constructor(
    private refs: EntityRefs,
    private ai: ComponentStore<WeaverAIComponent>,
    private transforms: ComponentStore<TransformComponent>,
    private weaverTraversal: ComponentStore<WeaverTraversalComponent>,
    private healths: ComponentStore<HealthComponent>,
    private broker: EventBroker,
    private commands: CommandBus
  ) {
    this.states.set("SWEEPING", new WeaverSweepingState());
    this.states.set("DASHING", new WeaverDashingState());
    this.states.set("RETURNING", new WeaverReturningState());
    this.states.set("DEFEATED", new WeaverDefeatedState());
  }

  public init(): void {
    this.resetBrain();

    this.unsubReset = this.broker.subscribe(GameEvent.GAME_RESET, () => {
      this.resetBrain();
    });

    this.unsubDamage = this.broker.subscribe(GameEvent.WEAVER_DAMAGED, () => {
      const aiComp = this.ai.get(this.refs.weaver);
      const health = this.healths.get(this.refs.weaver);
      if (aiComp && health) {
        if (health.current <= 0) {
          this.pendingTransition = "DEFEATED";
        } else if (aiComp.state === "SWEEPING") {
          this.pendingTransition = "DASHING";
        }
      }
    });
  }

  private resetBrain(): void {
    const aiComp = this.ai.get(this.refs.weaver);
    if (aiComp) {
      const startState = "SWEEPING" as WeaverStateType;
      const stateObj = this.states.get(startState) || this.states.get("SWEEPING")!;

      aiComp.state = stateObj.type;
      aiComp.hue = stateObj.hue;
      aiComp.timeInState = 0;

      this.activeState = stateObj;

      this.contextCache = {
        weaverId: this.refs.weaver,
        playerId: this.refs.player,
        ai: aiComp,
        transforms: this.transforms,
        weaverTraversal: this.weaverTraversal,
        healths: this.healths,
        commands: this.commands,
        broker: this.broker
      };

      this.activeState.enter(this.contextCache);
      this.publishStateChangeEvent(stateObj.name, stateObj.hue);
    }
    this.pendingTransition = null;
  }

  private publishStateChangeEvent(name: string, hue: string): void {
    const health = this.healths.get(this.refs.weaver);
    const isBerserk = health ? health.current < health.max * WEAVER_AI_TUNING.BERSERK_HP_THRESHOLD : false;
    let finalName = name;
    if (isBerserk && this.activeState?.type !== "DEFEATED") {
      finalName = `${name} (BERSERK)`;
    }
    this.broker.publish(GameEvent.WEAVER_STATE_CHANGE, {
      state: finalName,
      hue: hue
    });
  }

  private transitionTo(nextStateKey: WeaverStateType): void {
    const aiComp = this.ai.get(this.refs.weaver);
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
    const aiComp = this.ai.get(this.refs.weaver);
    if (!aiComp || !this.activeState) return;

    if (this.pendingTransition !== null) {
      this.transitionTo(this.pendingTransition);
      this.pendingTransition = null;
    }

    const pHealth = this.healths.get(this.refs.player);
    if (pHealth && pHealth.current <= 0) {
      this.commands.dispatch({
        type: "SET_KINEMATIC_VELOCITY",
        entityId: this.refs.weaver,
        x: 0,
        y: 0,
        z: 0
      });
      return;
    }

    if (!this.contextCache) {
      this.contextCache = {
        weaverId: this.refs.weaver,
        playerId: this.refs.player,
        ai: aiComp,
        transforms: this.transforms,
        weaverTraversal: this.weaverTraversal,
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
    if (this.unsubDamage) this.unsubDamage();
    if (this.unsubReset) this.unsubReset();
  }
}
