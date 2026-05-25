import { IWeaverState, WeaverStateType } from "../IWeaverState";
import { GameEvent } from "../../../core/events/GameEvents";
import { VISUAL_JUICE_CONFIG } from "../../../core/engine/ArenaConfig";
import { SystemContext } from "../../../core/engine/SystemContext";
import { WeaverAIComponent } from "../../../core/ecs/Components";

const HASH = String.fromCharCode(35);

export class WeaverDefeatedState implements IWeaverState {
  public readonly type: WeaverStateType = "DEFEATED";
  public readonly name = "WEAVER DEFEATED";
  public readonly hue = HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DEFEATED;

  public enter(ctx: SystemContext): void {
    const aiComp = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);
    if (aiComp) {
      aiComp.timeInState = 0;
      aiComp.hue = this.hue;
    }

    ctx.commands.dispatch({
      type: "SET_KINEMATIC_VELOCITY",
      entityId: ctx.refs.weaver,
      x: 0,
      y: 0,
      z: 0
    });

    ctx.broker.publish(GameEvent.WEAVER_DIED, undefined);
  }

  public exit(): void {}

  public update(ctx: SystemContext, dt: number): WeaverStateType | null {
    void ctx;
    void dt;
    return null;
  }
}
