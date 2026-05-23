import { IWardenState, WardenStateType, AIContext } from "./IWardenState";
import { SetKinematicVelocityCommand } from "../../physics/commands/PhysicsCommands";
import { GameEvent } from "../../core/events/GameEvents";

export class WardenChargeAttackState implements IWardenState {
    public readonly type: WardenStateType = "CHARGE_ATTACK";
    public readonly name = "RUSH ATTACK";
    public readonly hue = "#dc2626";
    private targetVector = { x: 0, y: 0 };

    public enter(ctx: AIContext): void {
        ctx.ai.timeInState = 0;
        const p = ctx.transforms.get(ctx.playerId);
        const w = ctx.transforms.get(ctx.wardenId);
        if (p && w) {
            const dx = p.x - w.x;
            const dy = p.y - w.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                this.targetVector.x = dx / dist;
                this.targetVector.y = dy / dist;
            } else {
                this.targetVector.x = 0;
                this.targetVector.y = -1;
            }
        }
    }

    public exit(_ctx: AIContext): void {}

    public update(ctx: AIContext, dt: number): WardenStateType | null {
        ctx.ai.timeInState += dt;
        const s = 22.0;
        ctx.commands.dispatch<SetKinematicVelocityCommand>({
            type: "SET_KINEMATIC_VELOCITY",
            entityId: ctx.wardenId,
            x: this.targetVector.x * s,
            y: this.targetVector.y * s,
            z: 0
        });
        const w = ctx.transforms.get(ctx.wardenId);
        if (w && (Math.abs(w.x) >= 13.5 || w.y <= 1.5 || w.y >= 27.5)) {
            ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.6, duration: 0.4 });
            return "RECOVERY";
        }
        return ctx.ai.timeInState > 1.2 ? "RECOVERY" : null;
    }
}
