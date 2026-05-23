import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";

export class LightingSystem implements ISystem {
    readonly phase = SystemPhase.RenderSync;
    private unsub: (() => void) | null = null;

    constructor(private broker: EventBroker) {}

    public init(): void {
        this.unsub = this.broker.subscribe(GameEvent.WARDEN_STATE_CHANGE, (payload) => {
            this.setWardenPhaseHue(payload.hue);
        });
    }

    public update(_dt: number): void {
        // Smooth light transitions
    }

    private setWardenPhaseHue(_colorHex: string): void {
        // Apply hex to Babylon light
    }

    public dispose(): void {
        if (this.unsub) this.unsub();
    }
}
