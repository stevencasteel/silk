import { SystemPhase } from "./SystemPhase";

export interface ISystem {
    readonly phase: SystemPhase;
    init?(): Promise<void> | void;
    update?(dt: number): void;
    render?(alpha: number): void;
    dispose?(): void;
}
