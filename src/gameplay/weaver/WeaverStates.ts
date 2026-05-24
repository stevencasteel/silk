import { IWeaverState, AIContext, WeaverStateType } from "./IWeaverState";
import { GameEvent } from "../../core/events/GameEvents";
import { ARENA_CONFIG, WEAVER_AI_TUNING, VISUAL_JUICE_CONFIG } from "../../core/engine/ArenaConfig";

const HASH = String.fromCharCode(35);

export class WeaverSweepingState implements IWeaverState {
  public readonly type: WeaverStateType = "SWEEPING";
  public readonly name = "SWEEPING CEILING";
  public readonly hue = HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.SWEEPING;
  private shootTimer = 0.0;
  private hasTelegraphed = false;

  public enter(ctx: AIContext): void {
    this.shootTimer = 0.0;
    this.hasTelegraphed = false;
    ctx.ai.timeInState = 0;
    ctx.ai.hue = this.hue;
    const health = ctx.healths.get(ctx.weaverId);
    const isBerserk = health ? health.current < health.max * WEAVER_AI_TUNING.BERSERK_HP_THRESHOLD : false;
    const patrolSpeed = isBerserk ? WEAVER_AI_TUNING.PATROL.SPEED_BERSERK : WEAVER_AI_TUNING.PATROL.SPEED_NORMAL;
    ctx.commands.dispatch({
      type: "SET_KINEMATIC_VELOCITY",
      entityId: ctx.weaverId,
      x: patrolSpeed,
      y: 0,
      z: 0
    });
  }

  public exit(): void {}

  public update(ctx: AIContext, dt: number): WeaverStateType | null {
    ctx.ai.timeInState += dt;
    this.shootTimer += dt;
    const telegraphThreshold = WEAVER_AI_TUNING.SHOOT.TELEGRAPH_TIME;
    if (this.shootTimer >= telegraphThreshold && !this.hasTelegraphed) {
      this.hasTelegraphed = true;
      ctx.ai.hue = HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_PREP;
      ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.12, duration: 0.15 });
    }
    if (this.shootTimer >= WEAVER_AI_TUNING.SHOOT.RELOAD_TIME) {
      this.shootTimer = 0.0;
      this.hasTelegraphed = false;
      ctx.ai.hue = this.hue;
      const playerTrans = ctx.transforms.get(ctx.playerId);
      const wTrans = ctx.transforms.get(ctx.weaverId);
      if (playerTrans && wTrans) {
        ctx.broker.publish(GameEvent.WEAVER_SHOOT, {
          x: wTrans.x,
          y: wTrans.y - WEAVER_AI_TUNING.SHOOT.OFFSET_Y,
          tx: playerTrans.x,
          ty: playerTrans.y
        });
      }
    }
    return null;
  }
}

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

  public enter(ctx: AIContext): void {
    const health = ctx.healths.get(ctx.weaverId);
    const isBerserk = health ? health.current < health.max * WEAVER_AI_TUNING.BERSERK_HP_THRESHOLD : false;
    this.dashCount = 0;
    this.maxDashes = isBerserk ? 3 : 2;
    this.startPrep(ctx);
  }

  public exit(): void {}

  private startPrep(ctx: AIContext): void {
    this.currentPhase = "PREP";
    this.phaseTimer = WEAVER_AI_TUNING.DASH.PREP_TIME;
    ctx.ai.hue = HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_PREP;
    ctx.commands.dispatch({
      type: "SET_KINEMATIC_VELOCITY",
      entityId: ctx.weaverId,
      x: 0,
      y: 0,
      z: 0
    });
    const playerTrans = ctx.transforms.get(ctx.playerId);
    if (playerTrans) {
      this.targetPos.x = playerTrans.x;
      this.targetPos.y = playerTrans.y;
    } else {
      this.targetPos.x = 0;
      this.targetPos.y = 14;
    }
  }

  private startThrust(ctx: AIContext): void {
    this.currentPhase = "THRUST";
    this.phaseTimer = WEAVER_AI_TUNING.DASH.THRUST_TIME;
    ctx.ai.hue = HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_THRUST;
    const weaverTrans = ctx.transforms.get(ctx.weaverId);
    if (weaverTrans) {
      const dx = this.targetPos.x - weaverTrans.x;
      const dy = this.targetPos.y - weaverTrans.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
      const speed = this.maxDashes === 3 ? WEAVER_AI_TUNING.DASH.SPEED_BERSERK : WEAVER_AI_TUNING.DASH.SPEED_NORMAL;
      this.thrustVelocity.x = (dx / dist) * speed;
      this.thrustVelocity.y = (dy / dist) * speed;
      ctx.commands.dispatch({
        type: "SET_KINEMATIC_VELOCITY",
        entityId: ctx.weaverId,
        x: this.thrustVelocity.x,
        y: this.thrustVelocity.y,
        z: 0
      });
    }
  }

  private startRecover(ctx: AIContext): void {
    this.currentPhase = "RECOVER";
    this.phaseTimer = WEAVER_AI_TUNING.DASH.RECOVER_TIME;
    ctx.ai.hue = HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_RECOVER;
    ctx.commands.dispatch({
      type: "SET_KINEMATIC_VELOCITY",
      entityId: ctx.weaverId,
      x: 0,
      y: 0,
      z: 0
    });
    ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.8, duration: 0.4 });
  }

  public update(ctx: AIContext, dt: number): WeaverStateType | null {
    this.phaseTimer -= dt;
    if (this.currentPhase === "PREP") {
      const StrobeHz = WEAVER_AI_TUNING.DASH.STROBE_FREQ;
      const step = Math.floor(this.phaseTimer * StrobeHz);
      ctx.ai.hue = step % 2 === 0 ? HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_THRUST : HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_PREP;
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
      const trav = ctx.weaverTraversal.get(ctx.weaverId);
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

export class WeaverReturningState implements IWeaverState {
  public readonly type: WeaverStateType = "RETURNING";
  public readonly name = "RETURNING TO CEILING";
  public readonly hue = HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.RETURNING;

  public enter(ctx: AIContext): void {
    ctx.ai.timeInState = 0;
    ctx.ai.hue = this.hue;
  }

  public exit(): void {}

  public update(ctx: AIContext, dt: number): WeaverStateType | null {
    ctx.ai.timeInState += dt;
    const wTrans = ctx.transforms.get(ctx.weaverId);
    if (wTrans) {
      const targetY = ARENA_CONFIG.VERTICAL.WEAVER_CEILING_RETURN_Y;
      const dy = targetY - wTrans.y;
      if (Math.abs(dy) < WEAVER_AI_TUNING.RETURN.THRESHOLD) {
        return "SWEEPING";
      }
      const speed = WEAVER_AI_TUNING.RETURN.SPEED;
      ctx.commands.dispatch({
        type: "SET_KINEMATIC_VELOCITY",
        entityId: ctx.weaverId,
        x: 0,
        y: speed,
        z: 0
      });
    }
    return null;
  }
}

export class WeaverDefeatedState implements IWeaverState {
  public readonly type: WeaverStateType = "DEFEATED";
  public readonly name = "WEAVER DEFEATED";
  public readonly hue = HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DEFEATED;

  public enter(ctx: AIContext): void {
    ctx.ai.timeInState = 0;
    ctx.ai.hue = this.hue;
    ctx.commands.dispatch({
      type: "SET_KINEMATIC_VELOCITY",
      entityId: ctx.weaverId,
      x: 0,
      y: 0,
      z: 0
    });
    ctx.broker.publish(GameEvent.WEAVER_DIED, undefined);
    // Shake handled by GameDirectorSystem
  }

  public exit(): void {}

  public update(): WeaverStateType | null {
    return null;
  }
}
