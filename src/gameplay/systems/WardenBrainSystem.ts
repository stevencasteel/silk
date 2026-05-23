import { ISystem } from "../../contracts/ISystem";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { WardenAIComponent, TransformComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { IWardenState, WardenStateType, AIContext } from "../states/IWardenState";
import { WardenDormantState } from "../states/WardenDormantState";
import { WardenHuntingState } from "../states/WardenHuntingState";
import { WardenChargePrepState } from "../states/WardenChargePrepState";
import { WardenChargeAttackState } from "../states/WardenChargeAttackState";
import { WardenRecoveryState } from "../states/WardenRecoveryState";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { CommandBus } from "../../core/commands/CommandBus";

export class WardenBrainSystem implements ISystem {
    private currentState: IWardenState;
    private states: Map<WardenStateType, IWardenState> = new Map();
    private ctx: AIContext;

    constructor(
        private refs: EntityRefs,
        private ai: ComponentStore<WardenAIComponent>,
        private transforms: ComponentStore<TransformComponent>,
        private broker: EventBroker,
        private commands: CommandBus
    ) {
        this.states.set("DORMANT", new WardenDormantState());
        this.states.set("HUNTING", new WardenHuntingState());
        this.states.set("CHARGE_PREP", new WardenChargePrepState());
        this.states.set("CHARGE_ATTACK", new WardenChargeAttackState());
        this.states.set("RECOVERY", new WardenRecoveryState());
        this.currentState = this.states.get("DORMANT") as IWardenState;
        this.ctx = { wardenId: -1, playerId: -1, ai: null as any, transforms: this.transforms, commands: this.commands, broker: this.broker };
    }

    public init(): void {
        this.ctx.wardenId = this.refs.warden;
        this.ctx.playerId = this.refs.player;
        this.ctx.ai = this.ai.get(this.refs.warden)!;
        this.currentState.enter(this.ctx);
        this.broker.publish(GameEvent.WARDEN_STATE_CHANGE, { state: this.currentState.name, hue: this.currentState.hue });
    }

    public update(dt: number): void {
        if (!this.ctx.ai) this.ctx.ai = this.ai.get(this.refs.warden)!;
        const nextStateType = this.currentState.update(this.ctx, dt);
        if (nextStateType && nextStateType !== this.currentState.type) {
            this.currentState.exit(this.ctx);
            const nextState = this.states.get(nextStateType);
            if (!nextState) throw new Error(`Warden state not found: ${nextStateType}`);
            this.currentState = nextState;
            this.currentState.enter(this.ctx);
            this.ctx.ai.state = this.currentState.name;
            this.ctx.ai.hue = this.currentState.hue;
            this.broker.publish(GameEvent.WARDEN_STATE_CHANGE, { state: this.currentState.name, hue: this.currentState.hue });
        }
    }
}
