import { ISystem } from "../../contracts/ISystem";
import { WardenData } from "../components/WardenData";
import { IWardenState, WardenStateType } from "../states/IWardenState";
import { WardenDormantState } from "../states/WardenDormantState";
import { WardenHuntingState } from "../states/WardenHuntingState";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";

export class WardenBrainSystem implements ISystem {
    private currentState: IWardenState;
    private states: Map<WardenStateType, IWardenState> = new Map();

    constructor(
        private wardenData: WardenData,
        private broker: EventBroker
    ) {
        this.states.set("DORMANT", new WardenDormantState());
        this.states.set("HUNTING", new WardenHuntingState());
        this.currentState = this.states.get("DORMANT") as IWardenState;
    }

    public init(): void {
        this.currentState.enter(this.wardenData);
        this.broker.publish(GameEvent.WARDEN_STATE_CHANGE, { 
            state: this.currentState.name, 
            hue: this.currentState.hue 
        });
    }

    public update(dt: number): void {
        const nextStateType = this.currentState.update(this.wardenData, dt);
        
        if (nextStateType && nextStateType !== this.currentState.type) {
            this.currentState.exit(this.wardenData);
            
            const nextState = this.states.get(nextStateType);
            if (!nextState) throw new Error(`Warden state not found: ${nextStateType}`);
            
            this.currentState = nextState;
            this.currentState.enter(this.wardenData);
            
            this.broker.publish(GameEvent.WARDEN_STATE_CHANGE, { 
                state: this.currentState.name, 
                hue: this.currentState.hue 
            });
        }
    }
}
