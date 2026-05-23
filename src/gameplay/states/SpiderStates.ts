import { ISpiderState, AIContext, SpiderStateType } from "./ISpiderState";
import { GameEvent } from "../../core/events/GameEvents";

export class SpiderSweepingState implements ISpiderState {
  public readonly type: SpiderStateType = "SWEEPING";
  public readonly name = "SWEEPING CEILING";
  public readonly hue = "#ef4444";

  public enter(ctx: AIContext): void {
    ctx.ai.timeInState = 0;
    
    const health = ctx.healths.get(ctx.spiderId);
    const isBerserk = health ? (health.current < health.max * 0.5) : false;
    const patrolSpeed = isBerserk ? 9.0 : 4.5;

    ctx.commands.dispatch({
      type: "SET_KINEMATIC_VELOCITY",
      entityId: ctx.spiderId,
      x: patrolSpeed,
      y: 0,
      z: 0
    });
  }

  public exit(ctx: AIContext): void {
    void ctx;
  }

  public update(ctx: AIContext, dt: number): SpiderStateType | null {
    ctx.ai.timeInState += dt;
    return null;
  }
}

export class SpiderDashingState implements ISpiderState {
  public readonly type: SpiderStateType = "DASHING";
  public readonly name = "SPIDER DASH";
  public readonly hue = "#f59e0b";

  private dashCount = 0;
  private maxDashes = 2;
  private currentPhase: "PREP" | "THRUST" | "RECOVER" = "PREP";
  private phaseTimer = 0.0;
  private targetPos = { x: 0, y: 0 };
  private thrustVelocity = { x: 0, y: 0 };

  public enter(ctx: AIContext): void {
    const health = ctx.healths.get(ctx.spiderId);
    const isBerserk = health ? (health.current < health.max * 0.5) : false;
    
    this.dashCount = 0;
    this.maxDashes = isBerserk ? 3 : 2;
    this.startPrep(ctx);
  }

  public exit(ctx: AIContext): void {
    void ctx;
  }

  private startPrep(ctx: AIContext): void {
    this.currentPhase = "PREP";
    this.phaseTimer = 0.6;
    ctx.ai.hue = "#f59e0b";
    
    ctx.commands.dispatch({
      type: "SET_KINEMATIC_VELOCITY",
      entityId: ctx.spiderId,
      x: 0, y: 0, z: 0
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
    this.phaseTimer = 0.8;
    ctx.ai.hue = "#dc2626";

    const spiderTrans = ctx.transforms.get(ctx.spiderId);
    if (spiderTrans) {
      const dx = this.targetPos.x - spiderTrans.x;
      const dy = this.targetPos.y - spiderTrans.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
      
      const speed = this.maxDashes === 3 ? 36.0 : 28.0;
      this.thrustVelocity.x = (dx / dist) * speed;
      this.thrustVelocity.y = (dy / dist) * speed;

      ctx.commands.dispatch({
        type: "SET_KINEMATIC_VELOCITY",
        entityId: ctx.spiderId,
        x: this.thrustVelocity.x,
        y: this.thrustVelocity.y,
        z: 0
      });
    }
  }

  private startRecover(ctx: AIContext): void {
    this.currentPhase = "RECOVER";
    this.phaseTimer = 0.5;
    ctx.ai.hue = "#a5f3fc";

    ctx.commands.dispatch({
      type: "SET_KINEMATIC_VELOCITY",
      entityId: ctx.spiderId,
      x: 0, y: 0, z: 0
    });

    ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.8, duration: 0.4 });
  }

  public update(ctx: AIContext, dt: number): SpiderStateType | null {
    this.phaseTimer -= dt;

    if (this.currentPhase === "PREP") {
      if (Math.random() < 0.3) {
        ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.05, duration: 0.05 });
      }
      if (this.phaseTimer <= 0) {
        this.startThrust(ctx);
      }
    } else if (this.currentPhase === "THRUST") {
      const trav = ctx.spiderTraversal.get(ctx.spiderId);
      const hitWallOrGround = trav ? (trav.isWallClinging || trav.isGrounded) : false;

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

export class SpiderReturningState implements ISpiderState {
  public readonly type: SpiderStateType = "RETURNING";
  public readonly name = "RETURNING TO CEILING";
  public readonly hue = "#4b5563";

  public enter(ctx: AIContext): void {
    ctx.ai.timeInState = 0;
  }

  public exit(ctx: AIContext): void {
    void ctx;
  }

  public update(ctx: AIContext, dt: number): SpiderStateType | null {
    ctx.ai.timeInState += dt;

    const sTrans = ctx.transforms.get(ctx.spiderId);
    if (sTrans) {
      const targetY = 27.2;
      const dy = targetY - sTrans.y;

      if (Math.abs(dy) < 0.3) {
        return "SWEEPING";
      }

      const speed = 12.0;
      ctx.commands.dispatch({
        type: "SET_KINEMATIC_VELOCITY",
        entityId: ctx.spiderId,
        x: 0,
        y: speed,
        z: 0
      });
    }

    return null;
  }
}

export class SpiderDefeatedState implements ISpiderState {
  public readonly type: SpiderStateType = "DEFEATED";
  public readonly name = "SPIDER DEFEATED";
  public readonly hue = "#111317";

  public enter(ctx: AIContext): void {
    ctx.ai.timeInState = 0;
    ctx.commands.dispatch({
      type: "SET_KINEMATIC_VELOCITY",
      entityId: ctx.spiderId,
      x: 0, y: 0, z: 0
    });
    ctx.broker.publish(GameEvent.SPIDER_DIED, undefined);
    ctx.broker.publish(GameEvent.GAME_WIN, undefined);
    ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 1.5, duration: 1.0 });
  }

  public exit(ctx: AIContext): void {
    void ctx;
  }

  public update(ctx: AIContext, dt: number): SpiderStateType | null {
    void ctx;
    void dt;
    return null;
  }
}
