import { getWeaverAbdomenTip, HASH_PREFIX } from "../../../core/utils/EngineUtils";
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
  WeaverAIComponent,
  WeaverCosmeticComponent,
  KinematicVelocityComponent
} from "../../../core/ecs/Components";

export class WeaverPatrollingState implements IWeaverState {
  public readonly type: WeaverStateType = "PATROLLING";
  public readonly name = "PATROLLING CEILING";
  public readonly hue = HASH_PREFIX + VISUAL_JUICE_CONFIG.WEAVER_COLORS.SWEEPING;
  public readonly audioParams = { baseFreq: 55, lfoHz: 0.2, harmonicity: 1.5 };
  private shootTimer = 0.0;
  private hasTelegraphed = false;

  public enter(ctx: SystemContext): void {
    this.shootTimer = 0.0;
    this.hasTelegraphed = false;

    const ai = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);
    if (ai) { ai.isThrusting = false; }
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

    const wVel = ctx.stores.get<KinematicVelocityComponent>("velocity").get(ctx.refs.weaver);
    const cosmeticStore = ctx.stores.get<WeaverCosmeticComponent>("weaverCosmetic");
    const cosmetic = cosmeticStore ? cosmeticStore.get(ctx.refs.weaver) : undefined;
    if (cosmetic && wVel) {
      const speed = Math.abs(wVel.x);
      const speedScale = Math.min(1.45, Math.max(0.45, speed / 4.5));
      cosmetic.emissiveHue = aiComp.hue;
      const pulse =
        Math.sin(aiComp.timeInState * WEAVER_AI_TUNING.ANIMATION.PULSE_FREQ) *
        WEAVER_AI_TUNING.ANIMATION.PULSE_BASE;
      cosmetic.targetScaleX = 1.0 + pulse;
      cosmetic.targetScaleY = 1.0 - pulse;
      cosmetic.targetScaleZ = 1.0;
      cosmetic.springStiffness = 120;
      cosmetic.springDamping = 22;

      const rollAngle = -wVel.x * WEAVER_AI_TUNING.ANIMATION.ROLL_ANGLE_SCALE;
      const mathAngle =
        Math.sin(aiComp.timeInState * WEAVER_AI_TUNING.ANIMATION.YAW_PITCH_ROLL_FREQ) *
        WEAVER_AI_TUNING.ANIMATION.YAW_PITCH_ROLL_AMP;
      cosmetic.wobbleAngle = mathAngle;
      cosmetic.rotationAngle = rollAngle;
      cosmetic.rotationSpeed = WEAVER_AI_TUNING.ANIMATION.LERP_RATE;

      cosmetic.gaitAmplitude = 0.13 * speedScale;
      cosmetic.gaitFrequency = 0.0; // Use dynamic traction
      cosmetic.gaitTuck = 0.0;
    }

    this.shootTimer += dt;
    const telegraphThreshold = WEAVER_AI_TUNING.SHOOT.TELEGRAPH_TIME;

    if (this.shootTimer >= telegraphThreshold && !this.hasTelegraphed) {
      this.hasTelegraphed = true;
      aiComp.hue = HASH_PREFIX + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_PREP;
      aiComp.shakeRequested = true;
      aiComp.shakeAmplitude = 0.12;
      aiComp.shakeDuration = 0.15;

      const transforms = ctx.stores.get<TransformComponent>("transform");
      const wTrans = transforms.get(ctx.refs.weaver);
      if (wTrans) {
        const radius = ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
        const tipWorld = getWeaverAbdomenTip(
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
        aiComp.shootTargetX = 0;
        aiComp.shootTargetY = 0;
        aiComp.shootIsRelease = false;
      }
    }

    if (this.shootTimer >= WEAVER_AI_TUNING.SHOOT.RELOAD_TIME) {
      this.shootTimer = 0.0;
      this.hasTelegraphed = false;
      aiComp.hue = this.hue;

      const transforms = ctx.stores.get<TransformComponent>("transform");
      const playerTrans = ctx.stores.get<TransformComponent>("transform").get(ctx.refs.player);
      const wTrans = transforms.get(ctx.refs.weaver);

      if (playerTrans && wTrans) {
        const radius = ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
        const tipWorld = getWeaverAbdomenTip(
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
        aiComp.shootIsRelease = true;
      }
    }
    return null;
  }
}
