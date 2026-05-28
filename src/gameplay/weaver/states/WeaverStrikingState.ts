import { IWeaverState, WeaverStateType } from "../IWeaverState";
import { GameEvent } from "../../../core/events/GameEvents";
import { WEAVER_AI_TUNING, VISUAL_JUICE_CONFIG, POST_PROCESSING_PRESETS } from "../../../core/engine/ArenaConfig";
import { SystemContext } from "../../../core/engine/SystemContext";
import {
  TransformComponent,
  HealthComponent,
  WeaverTraversalComponent,
  WeaverAIComponent
} from "../../../core/ecs/Components";
import { setKinematicVelocity } from "../../../core/utils/EngineUtils";

const HASH = String.fromCharCode(35);

export class WeaverStrikingState implements IWeaverState {
  public readonly type: WeaverStateType = "STRIKING";
  public readonly name = "WEAVER STRIKE";
  public readonly hue = HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_PREP;
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

    setKinematicVelocity(ctx, ctx.refs.weaver, 0, 0);

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
      aiComp.hue = HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_THRUST;
    }

    const transforms = ctx.stores.get<TransformComponent>("transform");
    const weaverTrans = transforms.get(ctx.refs.weaver);

    if (weaverTrans) {
      const dx = this.targetPos.x - weaverTrans.x;
      const dy = this.targetPos.y - weaverTrans.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
      const speed =
        this.maxStrikes === 3
          ? WEAVER_AI_TUNING.DASH.SPEED_BERSERK
          : WEAVER_AI_TUNING.DASH.SPEED_NORMAL;

      this.thrustVelocity.x = (dx / dist) * speed;
      this.thrustVelocity.y = (dy / dist) * speed;

      setKinematicVelocity(ctx, ctx.refs.weaver, this.thrustVelocity.x, this.thrustVelocity.y);
    }
  }

  private startRecover(ctx: SystemContext): void {
    this.currentPhase = "RECOVER";
    this.phaseTimer = WEAVER_AI_TUNING.DASH.RECOVER_TIME;

    const aiComp = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);
    if (aiComp) {
      aiComp.hue = HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_RECOVER;
    }

    setKinematicVelocity(ctx, ctx.refs.weaver, 0, 0);

    ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.8, duration: 0.4 });
  }

  public update(ctx: SystemContext, dt: number): WeaverStateType | null {
    this.phaseTimer -= dt;
    const aiComp = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);

    if (this.currentPhase === "PREP") {
      const strobeHz = WEAVER_AI_TUNING.DASH.STROBE_FREQ;
      const step = Math.floor(this.phaseTimer * strobeHz);
      if (aiComp) {
        aiComp.hue =
          step % 2 === 0
            ? HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_THRUST
            : HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_PREP;
      }

      if (Math.random() < WEAVER_AI_TUNING.DASH.CAMERA_SHAKE_PREP_FREQ) {
        ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
          amplitude: WEAVER_AI_TUNING.DASH.CAMERA_SHAKE_PREP_AMP,
          duration: WEAVER_AI_TUNING.DASH.CAMERA_SHAKE_PREP_DUR
        });
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
