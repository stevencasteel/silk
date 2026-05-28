import { getWeaverStingerTip, HASH_PREFIX } from "../../../core/utils/EngineUtils";
import { IWeaverState, WeaverStateType } from "../IWeaverState";
import {
  WEAVER_AI_TUNING,
  VISUAL_JUICE_CONFIG,
  ARENA_CONFIG
} from "../../../core/engine/ArenaConfig";
import { SystemContext } from "../../../core/engine/SystemContext";
import {
  TransformComponent,
  HealthComponent,
  WeaverAIComponent
} from "../../../core/ecs/Components";

export class WeaverPatrollingState implements IWeaverState {
  public readonly type: WeaverStateType = "PATROLLING";
  public readonly name = "PATROLLING CEILING";
  public readonly hue = HASH_PREFIX + VISUAL_JUICE_CONFIG.WEAVER_COLORS.SWEEPING;
  private shootTimer = 0.0;
  private hasTelegraphed = false;

  public enter(ctx: SystemContext): void {
    this.shootTimer = 0.0;
    this.hasTelegraphed = false;

    const ai = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);
    if (ai) {
      const healthStore = ctx.stores.get<HealthComponent>("health");
      const health = healthStore.get(ctx.refs.weaver);
      const isBerserk = health
        ? health.current < health.max * WEAVER_AI_TUNING.BERSERK_HP_THRESHOLD
        : false;
      const patrolSpeed = isBerserk
        ? WEAVER_AI_TUNING.PATROL.SPEED_BERSERK
        : WEAVER_AI_TUNING.PATROL.SPEED_NORMAL;

      ai.desiredVelocityX = patrolSpeed;
      ai.desiredVelocityY = 0;
    }
  }

  public exit(): void {}

  public update(ctx: SystemContext, dt: number): WeaverStateType | null {
    const aiComp = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);
    if (!aiComp) return null;

    this.shootTimer += dt;
    const telegraphThreshold = WEAVER_AI_TUNING.SHOOT.TELEGRAPH_TIME;

    if (this.shootTimer >= telegraphThreshold && !this.hasTelegraphed) {
      this.hasTelegraphed = true;
      aiComp.hue = HASH_PREFIX + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_PREP;
      aiComp.shakeRequested = true;
      aiComp.shakeAmplitude = 0.12;
      aiComp.shakeDuration = 0.15;
    }

    if (this.shootTimer >= WEAVER_AI_TUNING.SHOOT.RELOAD_TIME) {
      this.shootTimer = 0.0;
      this.hasTelegraphed = false;
      aiComp.hue = this.hue;

      const transforms = ctx.stores.get<TransformComponent>("transform");
      const playerTrans = transforms.get(ctx.refs.player);
      const wTrans = transforms.get(ctx.refs.weaver);

      if (playerTrans && wTrans) {
        const radius = ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
        const tipWorld = getWeaverStingerTip(
          wTrans.x,
          wTrans.y,
          wTrans.z,
          wTrans.qx,
          wTrans.qy,
          wTrans.qz,
          wTrans.qw,
          radius,
          1.0
        );

        aiComp.shootRequested = true;
        aiComp.shootOriginX = tipWorld.x;
        aiComp.shootOriginY = tipWorld.y;
        aiComp.shootTargetX = playerTrans.x;
        aiComp.shootTargetY = playerTrans.y;
      }
    }
    return null;
  }
}
