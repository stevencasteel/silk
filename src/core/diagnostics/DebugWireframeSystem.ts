import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EntityRefs } from "../ecs/EntityRefs";
import { ComponentStore } from "../ecs/ComponentStore";
import { TransformComponent, TetherComponent } from "../ecs/Components";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";

export class DebugWireframeSystem implements ISystem {
    readonly phase = SystemPhase.RenderSync;

    constructor(
        private _refs: EntityRefs,
        private _transforms: ComponentStore<TransformComponent>,
        private _tethers: ComponentStore<TetherComponent>,
        private _visualRegistry: IVisualRegistry
    ) {}

    public init(): void {
        void this._refs;
        void this._transforms;
        void this._tethers;
        void this._visualRegistry;
    }
    public update(_dt: number): void {
        void _dt;
    }
}
