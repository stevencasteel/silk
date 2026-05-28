import { WeaverSweepComponent, HealthComponent, KinematicVelocityComponent, TransformComponent } from "../../core/ecs/Components";
import { WEAVER_AI_TUNING } from "../../core/engine/ArenaConfig";

export class WeaverSweepHelper {
  public static updateSweepPhase(
    dt: number,
    sweep: WeaverSweepComponent,
    health: HealthComponent | undefined,
    vel: KinematicVelocityComponent,
    trans: TransformComponent
  ): void {
    const isBerserk = health
      ? health.current < health.max * WEAVER_AI_TUNING.BERSERK_HP_THRESHOLD
      : false;
    const sweepSpeed = isBerserk
      ? WEAVER_AI_TUNING.PATROL.SPEED_BERSERK
      : WEAVER_AI_TUNING.PATROL.SPEED_NORMAL;

    if (sweep.phase === "SWEEP") {
      vel.x = sweep.direction * sweepSpeed;
    } else if (sweep.phase === "LAUNCH") {
      const targetVel = sweep.direction * sweepSpeed;
      vel.x = vel.x + (targetVel - vel.x) * 5.0 * dt;

      const currentSpeed = Math.abs(vel.x);
      if (currentSpeed <= sweepSpeed * 1.05) {
        sweep.phase = "SWEEP";
        vel.x = sweep.direction * sweepSpeed;
      }
    } else if (sweep.phase === "HOLD") {
      sweep.timer -= dt;
      vel.x = 0;

      if (sweep.timer <= 0) {
        sweep.phase = "LAUNCH";
        vel.x = sweep.direction * sweepSpeed * 2.0;

        if (trans.scaleVelX !== undefined) {
          trans.scaleVelX += 4.5;
          trans.scaleVelY! += -3.5;
          trans.scaleVelZ! += -3.5;
        }
      }
    }
  }

  public static handleWallImpact(
    sweep: WeaverSweepComponent,
    vel: KinematicVelocityComponent,
    trans: TransformComponent,
    hitWallNormal: number
  ): void {
    sweep.phase = "HOLD";
    sweep.timer = 0.22;
    sweep.direction = hitWallNormal;
    vel.x = 0;

    if (trans.scaleVelX !== undefined) {
      trans.scaleVelX += -3.5;
      trans.scaleVelY! += 2.5;
      trans.scaleVelZ! += 2.5;
    }
  }
}
