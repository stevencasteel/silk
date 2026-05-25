import { IWeaverState, WeaverStateType } from "../IWeaverState";
import { ARENA_CONFIG, WEAVER_AI_TUNING, VISUAL_JUICE_CONFIG } from "../../../core/engine/ArenaConfig";
import { SystemContext } from "../../../core/engine/SystemContext";
import {
  TransformComponent,
  WeaverAIComponent
} from "../../../core/ecs/Components";

const HASH = String.fromCharCode(35);

export class WeaverReturningState implements IWeaverState {
  public readonly type: WeaverStateType = "RETURNING";
  public readonly name = "RETURNING TO CEILING";
  public readonly hue = HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.RETURNING;

  public enter(ctx: SystemContext): void {
    const aiComp = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);
    if (aiComp) {
      aiComp.timeInState = 0;
      aiComp.hue = this.hue;
    }
  }

  public exit(): void {}

  public update(ctx: SystemContext, dt: number): WeaverStateType | null {
    const aiComp = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);
    if (aiComp) {
      aiComp.timeInState += dt;
    }

    const transforms = ctx.stores.get<TransformComponent>("transform");
    const wTrans = transforms.get(ctx.refs.weaver);

    if (wTrans) {
      const targetY = ARENA_CONFIG.VERTICAL.WEAVER_CEILING_RETURN_Y;
      const dy = targetY - wTrans.y;
      if (Math.abs(dy) < WEAVER_AI_TUNING.RETURN.THRESHOLD) {
        return "SWEEPING";
      }

      const speed = WEAVER_AI_TUNING.RETURN.SPEED;
      ctx.commands.dispatch({
        type: "SET_KINEMATIC_VELOCITY",
        entityId: ctx.refs.weaver,
        x: 0,
        y: speed,
        z: 0
      });
    }
    return null;
  }
}
