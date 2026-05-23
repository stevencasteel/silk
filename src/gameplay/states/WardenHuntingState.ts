import { IWardenState, WardenStateType, AIContext } from "./IWardenState";
import { SetKinematicVelocityCommand } from "../../physics/commands/PhysicsCommands";

export class WardenHuntingState implements IWardenState {
  public readonly type: WardenStateType = "HUNTING";
  public readonly name = "HUNTING";
  public readonly hue = "#ef4444";

  public enter(ctx: AIContext): void {
    ctx.ai.timeInState = 0;
  }

  public exit(_ctx: AIContext): void {
    void _ctx;
  }

  public update(ctx: AIContext, dt: number): WardenStateType | null {
    ctx.ai.timeInState += dt;
    const p = ctx.transforms.get(ctx.playerId);
    const w = ctx.transforms.get(ctx.wardenId);
    const wTrav = ctx.wardenTraversal.get(ctx.wardenId);

    if (p && w && wTrav) {
      const dx = p.x - w.x;
      const dy = p.y - w.y;
      
      let moveX = 0;
      if (Math.abs(dx) > 2.0) {
        moveX = Math.sign(dx) * 5.0; 
      }
      
      let moveY = 0;
      if (wTrav.isGrounded && dy > 3.0 && Math.abs(dx) < 10.0) {
        moveY = 16.0; 
      }

      ctx.commands.dispatch<SetKinematicVelocityCommand>({
        type: "SET_KINEMATIC_VELOCITY",
        entityId: ctx.wardenId,
        x: moveX,
        y: moveY,
        z: 0
      });
    }
    return ctx.ai.timeInState > 4.0 ? "CHARGE_PREP" : null;
  }
}
