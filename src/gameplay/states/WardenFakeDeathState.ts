import { IWardenState, WardenStateType, AIContext } from "./IWardenState";
import { SetKinematicVelocityCommand } from "../../physics/commands/PhysicsCommands";
import { GameEvent } from "../../core/events/GameEvents";

export class WardenFakeDeathState implements IWardenState {
  public readonly type: WardenStateType = "FAKE_DEATH";
  public readonly name = "DEFEATED?";
  public readonly hue = "#1f2937";

  public enter(ctx: AIContext): void {
    ctx.ai.timeInState = 0;
    ctx.commands.dispatch<SetKinematicVelocityCommand>({
      type: "SET_KINEMATIC_VELOCITY",
      entityId: ctx.wardenId,
      x: 0,
      y: 0,
      z: 0
    });
    ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.6, duration: 0.8 });
  }

  public exit(_ctx: AIContext): void {}

  public update(ctx: AIContext, dt: number): WardenStateType | null {
    ctx.ai.timeInState += dt;
    return ctx.ai.timeInState > 3.0 ? "FINAL_PHASE" : null;
  }
}
