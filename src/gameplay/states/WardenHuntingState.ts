import { IWardenState, WardenStateType, AIContext } from "./IWardenState";
import { SetKinematicVelocityCommand } from "../../physics/commands/PhysicsCommands";
export class WardenHuntingState implements IWardenState {
    public readonly type: WardenStateType = "HUNTING"; public readonly name = "HUNTING"; public readonly hue = "#ef4444";
    public enter(ctx: AIContext): void { ctx.ai.timeInState = 0; }
    public exit(ctx: AIContext): void {}
    public update(ctx: AIContext, dt: number): WardenStateType | null {
        ctx.ai.timeInState += dt;
        const p = ctx.transforms.get(ctx.playerId); const w = ctx.transforms.get(ctx.wardenId);
        if (p && w) {
            const dx = p.x - w.x; const dy = p.y - w.y; const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0.1) { const s = 2.5; ctx.commands.dispatch<SetKinematicVelocityCommand>({ type: "SET_KINEMATIC_VELOCITY", entityId: ctx.wardenId, x: (dx / dist) * s, y: (dy / dist) * s, z: 0 }); }
            else ctx.commands.dispatch<SetKinematicVelocityCommand>({ type: "SET_KINEMATIC_VELOCITY", entityId: ctx.wardenId, x: 0, y: 0, z: 0 });
        }
        return ctx.ai.timeInState > 5.0 ? "CHARGE_PREP" : null;
    }
}
