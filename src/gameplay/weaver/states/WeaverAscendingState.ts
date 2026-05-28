import { IWeaverState, WeaverStateType } from "../IWeaverState";
import {
  ARENA_CONFIG,
  WEAVER_AI_TUNING,
  VISUAL_JUICE_CONFIG
} from "../../../core/engine/ArenaConfig";
import { SystemContext } from "../../../core/engine/SystemContext";
import { TransformComponent } from "../../../core/ecs/Components";
import { setKinematicVelocity, HASH_PREFIX } from "../../../core/utils/EngineUtils";



export class WeaverAscendingState implements IWeaverState {
  public readonly type: WeaverStateType = "ASCENDING";
  public readonly name = "ASCENDING TO CEILING";
  public readonly hue = HASH_PREFIX + VISUAL_JUICE_CONFIG.WEAVER_COLORS.RETURNING;

  public enter(ctx: SystemContext): void {
    void ctx;
  }

  public exit(): void {}

  public update(ctx: SystemContext, dt: number): WeaverStateType | null {
    void dt;

    const transforms = ctx.stores.get<TransformComponent>("transform");
    const wTrans = transforms.get(ctx.refs.weaver);

    if (wTrans) {
      const targetY = ARENA_CONFIG.VERTICAL.WEAVER_CEILING_RETURN_Y;
      const dy = targetY - wTrans.y;
      if (Math.abs(dy) < WEAVER_AI_TUNING.RETURN.THRESHOLD) {
        return "PATROLLING";
      }

      const speed = WEAVER_AI_TUNING.RETURN.SPEED;
      setKinematicVelocity(ctx, ctx.refs.weaver, 0, speed);
    }
    return null;
  }
}
