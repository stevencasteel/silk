import { IWeaverState, WeaverStateType } from "../IWeaverState";
import { GameEvent } from "../../../core/events/GameEvents";
import { VISUAL_JUICE_CONFIG } from "../../../core/engine/ArenaConfig";
import { SystemContext } from "../../../core/engine/SystemContext";
import { WeaverAIComponent } from "../../../core/ecs/Components";
import { HASH_PREFIX } from "../../../core/utils/EngineUtils";

export class WeaverDefeatedState implements IWeaverState {
  public readonly type: WeaverStateType = "DEFEATED";
  public readonly name = "WEAVER DEFEATED";
  public readonly hue = HASH_PREFIX + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DEFEATED;

  public enter(ctx: SystemContext): void {
    const ai = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);
    if (ai) {
      ai.desiredVelocityX = 0;
      ai.desiredVelocityY = 0;
    }
    ctx.broker.publish(GameEvent.WEAVER_DIED, undefined);
  }

  public exit(): void {}

  public update(ctx: SystemContext, dt: number): WeaverStateType | null {
    void ctx;
    void dt;
    return null;
  }
}
