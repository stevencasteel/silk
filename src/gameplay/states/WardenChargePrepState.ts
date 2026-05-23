import { IWardenState, WardenStateType, AIContext } from "./IWardenState";
import { SetKinematicVelocityCommand } from "../../physics/commands/PhysicsCommands";
import { GameEvent } from "../../core/events/GameEvents";

export class WardenChargePrepState implements IWardenState {
    public readonly type: WardenStateType = "CHARGE_PREP";
    public readonly name = "PREPARING CHARGE";
    public readonly hue = "#f59e0b";

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
        ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.08, duration: 0.1 });
        return ctx.ai.timeInState > 1.5 ? "CHARGE_ATTACK" : null;
    }
}
