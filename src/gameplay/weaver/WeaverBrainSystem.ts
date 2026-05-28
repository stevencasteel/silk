import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { WeaverAIComponent, HealthComponent } from "../../core/ecs/Components";
import { GameEvent } from "../../core/events/GameEvents";
import { IWeaverState, WeaverStateType } from "./IWeaverState";
import { WEAVER_AI_TUNING } from "../../core/engine/ArenaConfig";
import { SystemContext } from "../../core/engine/SystemContext";

export class WeaverBrainSystem implements ISystem {
  readonly phase = SystemPhase.Intents;
  private states = new Map<WeaverStateType, IWeaverState>();
  private activeState: IWeaverState | null = null;
  private unsubDamage: (() => void) | null = null;
  private unsubReset: (() => void) | null = null;
  private pendingTransition: WeaverStateType | null = null;

  constructor(private context: SystemContext) {}

  public registerState(state: IWeaverState): void {
    this.states.set(state.type, state);
  }

  public init(): void {
    this.resetBrain();

    this.unsubReset = this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
      this.resetBrain();
    });

    this.unsubDamage = this.context.broker.subscribe(GameEvent.WEAVER_DAMAGED, () => {
      const aiComp = this.context.stores
        .get<WeaverAIComponent>("weaverAI")
        .get(this.context.refs.weaver);
      const health = this.context.stores
        .get<HealthComponent>("health")
        .get(this.context.refs.weaver);

      if (aiComp && health) {
        aiComp.damageShearIntensity = 1.0;
        aiComp.damageShearTime = 0.0;
        if (health.current <= 0) {
          this.pendingTransition = "DEFEATED";
        } else if (aiComp.state === "PATROLLING") {
          this.pendingTransition = "STRIKING";
        }
      }
    });
  }

  private resetBrain(): void {
    const aiComp = this.context.stores
      .get<WeaverAIComponent>("weaverAI")
      .get(this.context.refs.weaver);
    if (aiComp) {
      const startState = "PATROLLING" as WeaverStateType;
      const stateObj = this.states.get(startState);
      if (stateObj) {
        aiComp.state = stateObj.type;
        aiComp.hue = stateObj.hue;
        aiComp.timeInState = 0;

        this.activeState = stateObj;
        this.activeState.enter(this.context);
        this.publishStateChangeEvent(stateObj.name, stateObj.hue);
      }
    }
    this.pendingTransition = null;
  }

  private publishStateChangeEvent(name: string, hue: string): void {
    const health = this.context.stores.get<HealthComponent>("health").get(this.context.refs.weaver);
    const isBerserk = health
      ? health.current < health.max * WEAVER_AI_TUNING.BERSERK_HP_THRESHOLD
      : false;
    let finalName = name;

    if (isBerserk && this.activeState?.type !== "DEFEATED") {
      finalName = `${name} (BERSERK)`;
    }
    const baseParams = this.activeState?.audioParams;
    let audioParams = baseParams;
    if (isBerserk && baseParams && this.activeState?.type === "PATROLLING") {
      audioParams = {
        baseFreq: 110,
        lfoHz: 4.0,
        harmonicity: 2.5
      };
    }
    this.context.broker.publish(GameEvent.WEAVER_STATE_CHANGE, {
      state: finalName,
      hue: hue,
      audioParams
    });
  }

  private transitionTo(nextStateKey: WeaverStateType): void {
    const aiComp = this.context.stores
      .get<WeaverAIComponent>("weaverAI")
      .get(this.context.refs.weaver);
    if (!aiComp || !this.activeState) return;

    const nextStateObj = this.states.get(nextStateKey);
    if (nextStateObj && nextStateKey !== this.activeState.type) {
      this.activeState.exit(this.context);

      aiComp.state = nextStateObj.type;
      aiComp.hue = nextStateObj.hue;
      aiComp.timeInState = 0;

      this.activeState = nextStateObj;
      this.activeState.enter(this.context);

      this.publishStateChangeEvent(nextStateObj.name, nextStateObj.hue);
    }
  }

  public update(dt: number): void {
    const aiComp = this.context.stores
      .get<WeaverAIComponent>("weaverAI")
      .get(this.context.refs.weaver);
    if (!aiComp || !this.activeState) return;

    aiComp.timeInState += dt;

    if (this.pendingTransition !== null) {
      this.transitionTo(this.pendingTransition);
      this.pendingTransition = null;
    }

    const pHealth = this.context.stores
      .get<HealthComponent>("health")
      .get(this.context.refs.player);
    if (pHealth && pHealth.current <= 0) {
      this.context.commands.dispatch({
        type: "SET_KINEMATIC_VELOCITY",
        entityId: this.context.refs.weaver,
        x: 0,
        y: 0,
        z: 0
      });
      return;
    }

    const nextStateKey = this.activeState.update(this.context, dt);

    if (nextStateKey && nextStateKey !== this.activeState.type) {
      this.transitionTo(nextStateKey);
    }
  }

  public dispose(): void {
    if (this.unsubDamage) this.unsubDamage();
    if (this.unsubReset) this.unsubReset();
  }
}
