import { IWardenState, WardenStateType, AIContext } from "./IWardenState";
import { SetKinematicVelocityCommand } from "../../physics/commands/PhysicsCommands";

export class WardenRecoveryState implements IWardenState {
    public readonly type: WardenStateType = "RECOVERY";
    public readonly name = "DAZED RECOVERY";
    public readonly hue = "#a5f3fc";

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

    public exit(_ctx: AIContext): void {
        void _ctx;
    }

    public update(ctx: AIContext, dt: number): WardenStateType | null {
        ctx.ai.timeInState += dt;
        return ctx.ai.timeInState > 2.5 ? "DORMANT" : null;
    }
}
