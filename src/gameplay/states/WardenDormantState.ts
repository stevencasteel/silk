import { IWardenState, WardenStateType, AIContext } from "./IWardenState";
import { SetKinematicVelocityCommand } from "../../physics/commands/PhysicsCommands";

export class WardenDormantState implements IWardenState {
    public readonly type: WardenStateType = "DORMANT";
    public readonly name = "DORMANT";
    public readonly hue = "#4b5563";

    public enter(ctx: AIContext): void {
        ctx.ai.timeInState = 0;
        ctx.commands.dispatch<SetKinematicVelocityCommand>({
            type: "SET_KINEMATIC_VELOCITY",
            entityId: ctx.wardenId,
            x: 0,
            y: 0,
            z: 0
        });
    }

    public exit(_ctx: AIContext): void {}

    public update(ctx: AIContext, dt: number): WardenStateType | null {
        ctx.ai.timeInState += dt;
        return ctx.ai.timeInState > 3.0 ? "HUNTING" : null;
    }
}
