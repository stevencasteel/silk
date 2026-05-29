import { IWeaverState, WeaverStateType } from "../IWeaverState";
import {
  ARENA_CONFIG,
  WEAVER_AI_TUNING,
  VISUAL_JUICE_CONFIG
} from "../../../core/engine/ArenaConfig";
import { SystemContext } from "../../../core/engine/SystemContext";
import {
  TransformComponent,
  WeaverAIComponent,
  WeaverCosmeticComponent
} from "../../../core/ecs/Components";
import { HASH_PREFIX } from "../../../core/utils/EngineUtils";

export class WeaverAscendingState implements IWeaverState {
  public readonly type: WeaverStateType = "ASCENDING";
  public readonly name = "ASCENDING TO CEILING";
  public readonly hue = HASH_PREFIX + VISUAL_JUICE_CONFIG.WEAVER_COLORS.RETURNING;
  public readonly audioParams = { baseFreq: 55, lfoHz: 0.2, harmonicity: 1.5 };

  public enter(ctx: SystemContext): void {
    void ctx;
  }

  public exit(): void {}

  public update(ctx: SystemContext, dt: number): WeaverStateType | null {
    void dt;

    const transforms = ctx.stores.get<TransformComponent>("transform");
    const wTrans = transforms.get(ctx.refs.weaver);
    const ai = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);

    if (wTrans && ai) {
      const cosmeticStore = ctx.stores.get<WeaverCosmeticComponent>("weaverCosmetic");
      const cosmetic = cosmeticStore ? cosmeticStore.get(ctx.refs.weaver) : undefined;
      if (cosmetic) {
        cosmetic.emissiveHue = ai.hue;
        cosmetic.targetScaleY = WEAVER_AI_TUNING.RETURN.SQUASH_STRETCH.Y;
        cosmetic.targetScaleX = WEAVER_AI_TUNING.RETURN.SQUASH_STRETCH.X;
        cosmetic.targetScaleZ = 1.0;
        cosmetic.springStiffness = 120;
        cosmetic.springDamping = 22;
        cosmetic.wobbleAngle = 0.0;
        cosmetic.rotationAngle = 0.0;
        cosmetic.rotationSpeed = WEAVER_AI_TUNING.ANIMATION.LERP_RATE;
        cosmetic.gaitAmplitude = 0.18; // Identical wide scramble steps as dash lunge
        cosmetic.gaitFrequency = 14.0; // Identical fast scrambling frequency as dash lunge
        cosmetic.gaitTuck = -0.5; // Identical outward reaching legs as dash lunge
      }
      const targetY = ARENA_CONFIG.VERTICAL.WEAVER_CEILING_RETURN_Y;
      const dy = targetY - wTrans.y;
      if (Math.abs(dy) < WEAVER_AI_TUNING.RETURN.THRESHOLD) {
        return "PATROLLING";
      }

      const speed = WEAVER_AI_TUNING.RETURN.SPEED;
      ai.desiredVelocityX = 0;
      ai.desiredVelocityY = speed;
    }
    return null;
  }
}
