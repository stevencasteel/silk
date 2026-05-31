import { IWeaverState, WeaverStateType } from "../IWeaverState";
import { GameEvent } from "../../../core/events/GameEvents";
import { VISUAL_JUICE_CONFIG, WEAVER_AI_TUNING } from "../../../core/engine/ArenaConfig";
import { SystemContext } from "../../../core/engine/SystemContext";
import { WeaverAIComponent, ActorCosmeticComponent } from "../../../core/ecs/Components";
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

      const cosmeticStore = ctx.stores.get<ActorCosmeticComponent>("cosmetic");
      const cosmetic = cosmeticStore ? cosmeticStore.get(ctx.refs.weaver) : undefined;
      if (cosmetic) {
        cosmetic.emissiveHue = ai.hue;
        cosmetic.targetScaleX = WEAVER_AI_TUNING.DEFEATED.SCALE;
        cosmetic.targetScaleY = WEAVER_AI_TUNING.DEFEATED.SCALE;
        cosmetic.targetScaleZ = WEAVER_AI_TUNING.DEFEATED.SCALE;
        cosmetic.springStiffness = 120;
        cosmetic.springDamping = 22;
        cosmetic.wobbleAngle = 0.0;
        cosmetic.rotationAngle = 0.0;
        cosmetic.rotationSpeed = WEAVER_AI_TUNING.ANIMATION.LERP_RATE;
        cosmetic.gaitAmplitude = 0.0;
        cosmetic.gaitFrequency = 5.0;
        cosmetic.gaitTuck = 0.82;
      }
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
