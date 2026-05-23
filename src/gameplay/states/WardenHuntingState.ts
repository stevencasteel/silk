import { WardenData } from "../components/WardenData";
import { IWardenState, WardenStateType } from "./IWardenState";

export class WardenHuntingState implements IWardenState {
    public readonly type: WardenStateType = "HUNTING";
    public readonly name = "HUNTING";
    public readonly hue = "#ef4444";

    public enter(data: WardenData): void {
        data.timeInState = 0;
    }

    public exit(data: WardenData): void {}

    public update(data: WardenData, dt: number): WardenStateType | null {
        data.timeInState += dt;
        if (data.timeInState > 10.0) {
            return "DORMANT";
        }
        return null;
    }
}
