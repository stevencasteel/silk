import { IWeaverState, WeaverStateType } from "../IWeaverState";
import { GameEvent } from "../../../core/events/GameEvents";
import {
  WEAVER_AI_TUNING,
  VISUAL_JUICE_CONFIG,
  POST_PROCESSING_PRESETS
} from "../../../core/engine/ArenaConfig";
import { SystemContext } from "../../../core/engine/SystemContext";
import {
  TransformComponent,
  HealthComponent,
  WeaverTraversalComponent,
  WeaverAIComponent,
  WeaverCosmeticComponent,
  KinematicVelocityComponent
} from "../../../core/ecs/Components";
import { HASH_PREFIX, getDistance2D } from "../../../core/utils/EngineUtils";

export class WeaverStrikingState implements IWeaverState {
  public readonly type: WeaverStateType = "STRIKING";
  public readonly name = "WEAVER STRIKE";
  public readonly hue = HASH_PREFIX + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_PREP;
  private strikeCount = 0;
  private maxStrikes = 2;
  private currentPhase: "PREP" | "THRUST" | "RECOVER" = "PREP";
  private phaseTimer = 0.0;
  private targetPos = { x: 0, y: 0 };
  private thrustVelocity = { x: 0, y: 0 };

  public enter(ctx: SystemContext): void {
    const healthStore = ctx.stores.get<HealthComponent>("health");
    const health = healthStore.get(ctx.refs.weaver);
    const isBerserk = health
      ? health.current < health.max * WEAVER_AI_TUNING.BERSERK_HP_THRESHOLD
      : false;
    this.strikeCount = 0;
    this.maxStrikes = isBerserk ? 3 : 2;
    this.startPrep(ctx);
  }

  public exit(): void {}

  private startPrep(ctx: SystemContext): void {
    this.currentPhase = "PREP";
    this.phaseTimer = WEAVER_AI_TUNING.DASH.PREP_TIME;

    const ai = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);
    if (ai) {
      ai.desiredVelocityX = 0;
      ai.desiredVelocityY = 0;
    }

    const transforms = ctx.stores.get<TransformComponent>("transform");
    const playerTrans = transforms.get(ctx.refs.player);

    if (playerTrans) {
      this.targetPos.x = playerTrans.x;
      this.targetPos.y = playerTrans.y;
    } else {
      this.targetPos.x = 0;
      this.targetPos.y = POST_PROCESSING_PRESETS.CAMERA.DEFAULT_TARGET.y;
    }
  }

  private startThrust(ctx: SystemContext): void {
    this.currentPhase = "THRUST";
    this.phaseTimer = WEAVER_AI_TUNING.DASH.THRUST_TIME;

    const aiComp = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);
    if (aiComp) {
      aiComp.hue = HASH_PREFIX + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_THRUST;
    }

    const transforms = ctx.stores.get<TransformComponent>("transform");
    const weaverTrans = transforms.get(ctx.refs.weaver);

    if (weaverTrans && aiComp) {
      const dx = this.targetPos.x - weaverTrans.x;
      const dy = this.targetPos.y - weaverTrans.y;
      const dist = getDistance2D(weaverTrans.x, weaverTrans.y, this.targetPos.x, this.targetPos.y);
      const speed =
        this.maxStrikes === 3
          ? WEAVER_AI_TUNING.DASH.SPEED_BERSERK
          : WEAVER_AI_TUNING.DASH.SPEED_NORMAL;

      this.thrustVelocity.x = (dx / dist) * speed;
      this.thrustVelocity.y = (dy / dist) * speed;

      aiComp.desiredVelocityX = this.thrustVelocity.x;
      aiComp.desiredVelocityY = this.thrustVelocity.y;
    }
  }

  private startRecover(ctx: SystemContext): void {
    this.currentPhase = "RECOVER";
    this.phaseTimer = WEAVER_AI_TUNING.DASH.RECOVER_TIME;

    const aiComp = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);
    if (aiComp) {
      aiComp.hue = HASH_PREFIX + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_RECOVER;
      aiComp.desiredVelocityX = 0;
      aiComp.desiredVelocityY = 0;
      aiComp.shakeRequested = true;
      aiComp.shakeAmplitude = 0.8;
      aiComp.shakeDuration = 0.4;
    }
  }

  public update(ctx: SystemContext, dt: number): WeaverStateType | null {
    this.phaseTimer -= dt;
    const aiComp = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);
    if (!aiComp) return null;

    const wVel = ctx.stores.get<KinematicVelocityComponent>("velocity").get(ctx.refs.weaver);
    const cosmeticStore = ctx.stores.get<WeaverCosmeticComponent>("weaverCosmetic");
    const cosmetic = cosmeticStore ? cosmeticStore.get(ctx.refs.weaver) : undefined;
    if (cosmetic && wVel) {
      cosmetic.emissiveHue = aiComp.hue;
      const speed = Math.sqrt(wVel.x * wVel.x + wVel.y * wVel.y);
      if (speed < WEAVER_AI_TUNING.DASH.SPEED_THRESHOLD) {
        cosmetic.targetScaleY = WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.PREP_Y;
        cosmetic.targetScaleX = WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.PREP_X;
        cosmetic.targetScaleZ = WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.PREP_Z;
        const wobbleFreq = 12.0;
        const wobbleAmp =
          0.08 * Math.max(0.0, 1.0 - aiComp.timeInState / WEAVER_AI_TUNING.DASH.PREP_TIME);
        cosmetic.wobbleAngle =
          Math.sin(aiComp.timeInState * wobbleFreq) * Math.max(0.02, wobbleAmp);
        cosmetic.rotationAngle = 0.0;
        cosmetic.gaitAmplitude = 0.035;
        cosmetic.gaitFrequency = 13.0;
        cosmetic.gaitTuck = 0.72;
      } else {
        const stretch = Math.min(
          WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.STRETCH_MAX,
          (speed / WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.STRETCH_SPEED_BASIS) *
            WEAVER_AI_TUNING.DASH.SQUASH_STRETCH.STRETCH_MAX
        );
        cosmetic.targetScaleY = 1.0 + stretch;
        cosmetic.targetScaleX = 1.0 - stretch * 0.5;
        cosmetic.targetScaleZ = 1.0 - stretch * 0.5;
        cosmetic.wobbleAngle = 0.0;
        cosmetic.rotationAngle = Math.atan2(wVel.y, wVel.x) + Math.PI / 2;
        cosmetic.gaitAmplitude = 0.055;
        cosmetic.gaitFrequency = 8.5;
        cosmetic.gaitTuck = -0.42;
      }
      cosmetic.springStiffness = 120;
      cosmetic.springDamping = 22;
      cosmetic.rotationSpeed = WEAVER_AI_TUNING.ANIMATION.LERP_RATE;
    }

    if (this.currentPhase === "PREP") {
      const strobeHz = WEAVER_AI_TUNING.DASH.STROBE_FREQ;
      const step = Math.floor(this.phaseTimer * strobeHz);
      aiComp.hue =
        step % 2 === 0
          ? HASH_PREFIX + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_THRUST
          : HASH_PREFIX + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_PREP;

      if (Math.random() < WEAVER_AI_TUNING.DASH.CAMERA_SHAKE_PREP_FREQ) {
        aiComp.shakeRequested = true;
        aiComp.shakeAmplitude = WEAVER_AI_TUNING.DASH.CAMERA_SHAKE_PREP_AMP;
        aiComp.shakeDuration = WEAVER_AI_TUNING.DASH.CAMERA_SHAKE_PREP_DUR;
      }

      if (this.phaseTimer <= 0) {
        this.startThrust(ctx);
      }
    } else if (this.currentPhase === "THRUST") {
      const traversalStore = ctx.stores.get<WeaverTraversalComponent>("weaverTraversal");
      const trav = traversalStore.get(ctx.refs.weaver);
      const isGraceOver =
        this.phaseTimer <
        WEAVER_AI_TUNING.DASH.THRUST_TIME - WEAVER_AI_TUNING.DASH.COLLISION_GRACE_TIME;
      const hitWallOrGround = isGraceOver && trav ? trav.isWallClinging || trav.isGrounded : false;

      if (this.phaseTimer <= 0 || hitWallOrGround) {
        if (hitWallOrGround) {
          const transforms = ctx.stores.get<TransformComponent>("transform");
          const wTrans = transforms.get(ctx.refs.weaver);
          if (wTrans) {
            ctx.broker.publish(GameEvent.WEAVER_WALL_HIT, {
              x: wTrans.x,
              y: wTrans.y,
              wallNormalX: trav ? trav.wallNormalX : 0
            });
            if (wTrans.scaleVelX === undefined) wTrans.scaleVelX = 0;
            if (wTrans.scaleVelY === undefined) wTrans.scaleVelY = 0;
            if (wTrans.scaleVelZ === undefined) wTrans.scaleVelZ = 0;
            if (trav && trav.isWallClinging) {
              wTrans.scaleVelX += -3.5;
              wTrans.scaleVelY += 2.5;
              wTrans.scaleVelZ += 2.5;
            } else if (trav && trav.isGrounded) {
              wTrans.scaleVelY += -3.5;
              wTrans.scaleVelX += 2.5;
              wTrans.scaleVelZ += 2.5;
            }
          }
        }
        this.startRecover(ctx);
      }
    } else if (this.currentPhase === "RECOVER") {
      if (this.phaseTimer <= 0) {
        this.strikeCount++;
        if (this.strikeCount >= this.maxStrikes) {
          return "ASCENDING";
        } else {
          this.startPrep(ctx);
        }
      }
    }
    return null;
  }
}
