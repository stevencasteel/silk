import { IWeaverState, WeaverStateType } from "../IWeaverState";
import { GameEvent } from "../../../core/events/GameEvents";
import { WEAVER_AI_TUNING, VISUAL_JUICE_CONFIG } from "../../../core/engine/ArenaConfig";
import { SystemContext } from "../../../core/engine/SystemContext";
import {
  TransformComponent,
  HealthComponent,
  WeaverTraversalComponent,
  WeaverAIComponent
} from "../../../core/ecs/Components";

const HASH = String.fromCharCode(35);

export class WeaverDashingState implements IWeaverState {
  public readonly type: WeaverStateType = "DASHING";
  public readonly name = "WEAVER DASH";
  public readonly hue = HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_PREP;
  private dashCount = 0;
  private maxDashes = 2;
  private currentPhase: "PREP" | "THRUST" | "RECOVER" = "PREP";
  private phaseTimer = 0.0;
  private targetPos = { x: 0, y: 0 };
  private thrustVelocity = { x: 0, y: 0 };

  public enter(ctx: SystemContext): void {
    const healthStore = ctx.stores.get<HealthComponent>("health");
    const health = healthStore.get(ctx.refs.weaver);
    const isBerserk = health ? health.current < health.max * WEAVER_AI_TUNING.BERSERK_HP_THRESHOLD : false;
    this.dashCount = 0;
    this.maxDashes = isBerserk ? 3 : 2;
    this.startPrep(ctx);
  }

  public exit(): void {}

  private startPrep(ctx: SystemContext): void {
    this.currentPhase = "PREP";
    this.phaseTimer = WEAVER_AI_TUNING.DASH.PREP_TIME;
    
    const aiComp = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);
    if (aiComp) {
      aiComp.hue = HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_PREP;
    }

    ctx.commands.dispatch({
      type: "SET_KINEMATIC_VELOCITY",
      entityId: ctx.refs.weaver,
      x: 0,
      y: 0,
      z: 0
    });

    const transforms = ctx.stores.get<TransformComponent>("transform");
    const playerTrans = transforms.get(ctx.refs.player);

    if (playerTrans) {
      this.targetPos.x = playerTrans.x;
      this.targetPos.y = playerTrans.y;
    } else {
      this.targetPos.x = 0;
      this.targetPos.y = 14;
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
      const speed = this.maxDashes === 3 ? WEAVER_AI_TUNING.DASH.SPEED_BERSERK : WEAVER_AI_TUNING.DASH.SPEED_NORMAL;
      
      this.thrustVelocity.x = (dx / dist) * speed;
      this.thrustVelocity.y = (dy / dist) * speed;

      ctx.commands.dispatch({
        type: "SET_KINEMATIC_VELOCITY",
        entityId: ctx.refs.weaver,
        x: this.thrustVelocity.x,
        y: this.thrustVelocity.y,
        z: 0
      });
    }
  }

  private startRecover(ctx: SystemContext): void {
    this.currentPhase = "RECOVER";
    this.phaseTimer = WEAVER_AI_TUNING.DASH.RECOVER_TIME;

    const aiComp = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);
    if (aiComp) {
      aiComp.hue = HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_RECOVER;
    }

    ctx.commands.dispatch({
      type: "SET_KINEMATIC_VELOCITY",
      entityId: ctx.refs.weaver,
      x: 0,
      y: 0,
      z: 0
    });

    ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.8, duration: 0.4 });
  }

  public update(ctx: SystemContext, dt: number): WeaverStateType | null {
    this.phaseTimer -= dt;
    const aiComp = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);

    if (this.currentPhase === "PREP") {
      const strobeHz = WEAVER_AI_TUNING.DASH.STROBE_FREQ;
      const step = Math.floor(this.phaseTimer * strobeHz);
      if (aiComp) {
        aiComp.hue = step % 2 === 0 ? HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_THRUST : HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_PREP;
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
      const isGraceOver = this.phaseTimer < (WEAVER_AI_TUNING.DASH.THRUST_TIME - WEAVER_AI_TUNING.DASH.COLLISION_GRACE_TIME);
      const hitWallOrGround = isGraceOver && trav ? (trav.isWallClinging || trav.isGrounded) : false;

      if (this.phaseTimer <= 0 || hitWallOrGround) {
        this.startRecover(ctx);
      }
    } else if (this.currentPhase === "RECOVER") {
      if (this.phaseTimer <= 0) {
        this.dashCount++;
        if (this.dashCount >= this.maxDashes) {
          return "RETURNING";
        } else {
          this.startPrep(ctx);
        }
      }
    }
    return null;
  }
}
