import { IWardenState, AIContext, WardenStateType } from "./IWardenState";
import { GameEvent } from "../../core/events/GameEvents";

export class WardenSweepingState implements IWardenState {
  public readonly type: WardenStateType = "SWEEPING";
  public readonly name = "SWEEPING CEILING";
  public readonly hue = "#ef4444";

  public enter(ctx: AIContext): void {
    ctx.ai.timeInState = 0;
    
    const health = ctx.healths.get(ctx.wardenId);
    const isBerserk = health ? (health.current < health.max * 0.5) : false;
    const patrolSpeed = isBerserk ? 9.0 : 4.5;

    ctx.commands.dispatch({
      type: "SET_KINEMATIC_VELOCITY",
      entityId: ctx.wardenId,
      x: patrolSpeed,
      y: 0,
      z: 0
    });
  }

  public exit(ctx: AIContext): void {
    void ctx;
  }

  public update(ctx: AIContext, dt: number): WardenStateType | null {
    ctx.ai.timeInState += dt;
    return null;
  }
}

export class WardenDashingState implements IWardenState {
  public readonly type: WardenStateType = "DASHING";
  public readonly name = "WARDEN DASH";
  public readonly hue = "#f59e0b";

  private dashCount = 0;
  private maxDashes = 2;
  private currentPhase: "PREP" | "THRUST" | "RECOVER" = "PREP";
  private phaseTimer = 0.0;
  private targetPos = { x: 0, y: 0 };
  private thrustVelocity = { x: 0, y: 0 };

  public enter(ctx: AIContext): void {
    const health = ctx.healths.get(ctx.wardenId);
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
      entityId: ctx.wardenId,
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

    const wardenTrans = ctx.transforms.get(ctx.wardenId);
    if (wardenTrans) {
      const dx = this.targetPos.x - wardenTrans.x;
      const dy = this.targetPos.y - wardenTrans.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
      
      const speed = this.maxDashes === 3 ? 36.0 : 28.0;
      this.thrustVelocity.x = (dx / dist) * speed;
      this.thrustVelocity.y = (dy / dist) * speed;

      ctx.commands.dispatch({
        type: "SET_KINEMATIC_VELOCITY",
        entityId: ctx.wardenId,
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
      entityId: ctx.wardenId,
      x: 0, y: 0, z: 0
    });

    ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.8, duration: 0.4 });
  }

  public update(ctx: AIContext, dt: number): WardenStateType | null {
    this.phaseTimer -= dt;

    if (this.currentPhase === "PREP") {
      if (Math.random() < 0.3) {
        ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.05, duration: 0.05 });
      }
      if (this.phaseTimer <= 0) {
        this.startThrust(ctx);
      }
    } else if (this.currentPhase === "THRUST") {
      const trav = ctx.wardenTraversal.get(ctx.wardenId);
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

export class WardenReturningState implements IWardenState {
  public readonly type: WardenStateType = "RETURNING";
  public readonly name = "RETURNING TO CEILING";
  public readonly hue = "#4b5563";

  public enter(ctx: AIContext): void {
    ctx.ai.timeInState = 0;
  }

  public exit(ctx: AIContext): void {
    void ctx;
  }

  public update(ctx: AIContext, dt: number): WardenStateType | null {
    ctx.ai.timeInState += dt;

    const wTrans = ctx.transforms.get(ctx.wardenId);
    if (wTrans) {
      const targetY = 27.2;
      const dy = targetY - wTrans.y;

      if (Math.abs(dy) < 0.3) {
        return "SWEEPING";
      }

      const speed = 12.0;
      ctx.commands.dispatch({
        type: "SET_KINEMATIC_VELOCITY",
        entityId: ctx.wardenId,
        x: 0,
        y: speed,
        z: 0
      });
    }

    return null;
  }
}

export class WardenDefeatedState implements IWardenState {
  public readonly type: WardenStateType = "DEFEATED";
  public readonly name = "WARDEN DEFEATED";
  public readonly hue = "#111317";

  public enter(ctx: AIContext): void {
    ctx.ai.timeInState = 0;
    ctx.commands.dispatch({
      type: "SET_KINEMATIC_VELOCITY",
      entityId: ctx.wardenId,
      x: 0, y: 0, z: 0
    });
    ctx.broker.publish(GameEvent.WARDEN_DIED, undefined);
    ctx.broker.publish(GameEvent.GAME_WIN, undefined);
    ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 1.5, duration: 1.0 });
  }

  public exit(ctx: AIContext): void {
    void ctx;
  }

  public update(ctx: AIContext, dt: number): WardenStateType | null {
    void ctx;
    void dt;
    return null;
  }
}
