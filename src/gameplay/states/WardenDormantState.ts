import { WardenData } from "../components/WardenData";
import { IWardenState, WardenStateType } from "./IWardenState";

export class WardenDormantState implements IWardenState {
    public readonly type: WardenStateType = "DORMANT";
    public readonly name = "DORMANT";
    public readonly hue = "#6b7280";

    public enter(data: WardenData): void {
        data.timeInState = 0;
    }

    public exit(data: WardenData): void {}

    public update(data: WardenData, dt: number): WardenStateType | null {
        data.timeInState += dt;
        if (data.timeInState > 5.0) {
            return "HUNTING";
        }
        return null;
    }
}
