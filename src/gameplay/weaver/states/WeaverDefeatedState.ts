import { IWeaverState, WeaverStateType } from "../IWeaverState";
import { GameEvent } from "../../../core/events/GameEvents";
import { VISUAL_JUICE_CONFIG } from "../../../core/engine/ArenaConfig";
import { SystemContext } from "../../../core/engine/SystemContext";
import { setKinematicVelocity } from "../../../core/utils/EngineUtils";

const HASH = String.fromCharCode(35);

export class WeaverDefeatedState implements IWeaverState {
  public readonly type: WeaverStateType = "DEFEATED";
  public readonly name = "WEAVER DEFEATED";
  public readonly hue = HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DEFEATED;

  public enter(ctx: SystemContext): void {
    setKinematicVelocity(ctx, ctx.refs.weaver, 0, 0);
    ctx.broker.publish(GameEvent.WEAVER_DIED, undefined);
  }

  public exit(): void {}

  public update(ctx: SystemContext, dt: number): WeaverStateType | null {
    void ctx;
    void dt;
    return null;
  }
}
