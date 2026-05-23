import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { Profiler } from "./Profiler";
import { EventBroker } from "../events/EventBroker";
import { EntityRegistry } from "../ecs/Entity";

export class DebugTelemetryOverlay implements ISystem {
    readonly phase = SystemPhase.RenderSync;

    constructor(
        private _profiler: Profiler,
        private _broker: EventBroker,
        private _entities: EntityRegistry
    ) {}

    public init(): void {
        void this._profiler;
        void this._broker;
        void this._entities;
    }
    public update(_dt: number): void {}
}
