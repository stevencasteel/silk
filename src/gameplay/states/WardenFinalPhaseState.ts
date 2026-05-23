import { IWardenState, WardenStateType, AIContext } from "./IWardenState";
import { SetKinematicVelocityCommand } from "../../physics/commands/PhysicsCommands";
import { GameEvent } from "../../core/events/GameEvents";

export class WardenFinalPhaseState implements IWardenState {
  public readonly type: WardenStateType = "FINAL_PHASE";
  public readonly name = "BERSERK OVERDRIVE";
  public readonly hue = "#f97316";

  public enter(ctx: AIContext): void {
    ctx.ai.timeInState = 0;

    const wHealth = ctx.healths.get(ctx.wardenId);
    if (wHealth) {
      wHealth.current = wHealth.max * 0.5;
      ctx.broker.publish(GameEvent.WARDEN_HEALTH_CHANGED, { hp: wHealth.current, maxHp: wHealth.max });
    }

    ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 1.0, duration: 1.2 });
  }

  public exit(_ctx: AIContext): void {}

  public update(ctx: AIContext, dt: number): WardenStateType | null {
    ctx.ai.timeInState += dt;

    const p = ctx.transforms.get(ctx.playerId);
    const w = ctx.transforms.get(ctx.wardenId);

    if (p && w) {
      const dx = p.x - w.x;
      const dy = p.y - w.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const finalPhaseSpeed = 15.0;
      ctx.commands.dispatch<SetKinematicVelocityCommand>({
        type: "SET_KINEMATIC_VELOCITY",
        entityId: ctx.wardenId,
        x: (dx / dist) * finalPhaseSpeed,
        y: (dy / dist) * finalPhaseSpeed,
        z: 0
      });

      if (dist < 6.0 && Math.random() < 0.2) {
        ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.15, duration: 0.1 });
      }
    }

    return null;
  }
}
