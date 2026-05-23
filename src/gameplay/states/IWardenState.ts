import { WardenData } from "../components/WardenData";

export type WardenStateType = "DORMANT" | "HUNTING";

export interface IWardenState {
    readonly type: WardenStateType;
    readonly name: string;
    readonly hue: string;
    enter(data: WardenData): void;
    exit(data: WardenData): void;
    update(data: WardenData, dt: number): WardenStateType | null;
}
