import { SystemContext } from "../../../core/engine/SystemContext";
import {
  KinematicTargetComponent,
  KinematicVelocityComponent,
  TetherComponent,
  TraversalStateComponent,
  TransformComponent,
  ParticleRequestComponent
} from "../../../core/ecs/Components";
import { GAMEPLAY_TUNING, CANONICAL_UNITS } from "../../../core/engine/ArenaConfig";
import { getDistance2D } from "../../../core/utils/EngineUtils";
import { GameEvent } from "../../../core/events/GameEvents";
import { LaunchTrailStrategy } from "../../juice/ParticleStrategies";

export class PlayerStateUtils {
  public static enforcePendulumConstraint(
    target: KinematicTargetComponent,
    vel: KinematicVelocityComponent,
    tether: TetherComponent
  ): void {
    const dx = target.x - tether.anchorX;
    const dy = target.y - tether.anchorY;
    const dist = getDistance2D(target.x, target.y, tether.anchorX, tether.anchorY);

    const activeMaxLength = tether.maxLength;

    if (dist > activeMaxLength) {
      const nx = dx / dist;
      const ny = dy / dist;

      target.x = tether.anchorX + nx * activeMaxLength;
      target.y = tether.anchorY + ny * activeMaxLength;

      const dVal = vel.x * nx + vel.y * ny;
      if (dVal > 0) {
        vel.x -= dVal * nx;
        vel.y -= dVal * ny;
      }
    }
  }

  public static triggerFling(
    ctx: SystemContext,
    vel: KinematicVelocityComponent,
    tether: TetherComponent,
    target: KinematicTargetComponent,
    trav: TraversalStateComponent
  ): void {
    const storedTension = tether.tension;
    tether.tension = 0.0;
    const tuning = GAMEPLAY_TUNING.PLAYER;
    const reelConfig = GAMEPLAY_TUNING.REEL;

    trav.stickyEntityId = -1;

    if (storedTension < tuning.MIN_FLING_TENSION) {
      trav.state = "AIRBORNE";
      trav.wallDir = 0;
      trav.launchPower = 0;
      return;
    }

    const dx = tether.anchorX - target.x;
    const dy = tether.anchorY - target.y;
    const dist = getDistance2D(target.x, target.y, tether.anchorX, tether.anchorY);

    const tensionPower = Math.min(1.0, storedTension);
    const reelBonus =
      tether.reelVelocity < 0 ? Math.min(0.25, Math.abs(tether.reelVelocity) / 20.0) : 0;
    const isSweetSpot =
      storedTension >= reelConfig.SWEET_SPOT_MIN && storedTension <= reelConfig.SWEET_SPOT_MAX;
    const sweetSpotBonus = isSweetSpot ? 0.15 : 0.0;

    // Apply +10% fling bonus if they broke free from a wall-locked trap!
    const bonusMultiplier = trav.hasFlingBonus ? 1.10 : 1.0;
    const powerScale = Math.min(1.0, tensionPower + reelBonus + sweetSpotBonus);
    const power = powerScale * tuning.FLING_IMPULSE * bonusMultiplier;

    vel.x = (dx / dist) * power;
    vel.y = (dy / dist) * power;

    trav.state = "LAUNCHING";
    trav.launchTimer = tuning.LAUNCH_DURATION;
    trav.launchPower = powerScale;
    trav.wallDir = 0;

    const transforms = ctx.stores.get<TransformComponent>("transform");
    const pTrans = transforms.get(ctx.refs.player);
    if (pTrans) {
      pTrans.scaleVelY = powerScale * 15.0;
      pTrans.scaleVelX = -powerScale * 7.5;
      pTrans.scaleVelZ = -powerScale * 7.5;
    }

    let shakeAmp = 0.25 + powerScale * 0.35;
    let shakeDur = 0.2;

    if (trav.hasFlingBonus) {
      trav.hasFlingBonus = false; // Reset the bonus flag
      shakeAmp += 0.50;
      shakeDur += 0.25;

      // Spawn extra launch exhaustion trails to indicate the powerful breakaway
      const reqStore = ctx.stores.get<ParticleRequestComponent>("particleRequest");
      if (reqStore) {
        for (let i = 0; i < 4; i++) {
          const reqId = ctx.world.create();
          reqStore.add(reqId, {
            strategy: new LaunchTrailStrategy(),
            x: target.x,
            y: target.y,
            z: 0
          });
        }
      }
    } else if (storedTension >= CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT) {
      shakeAmp = 0.85;
      shakeDur = 0.45;
    } else if (isSweetSpot) {
      shakeAmp = 0.5;
      shakeDur = 0.28;
    }

    ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
      amplitude: shakeAmp,
      duration: shakeDur,
      dirX: dx / dist,
      dirY: dy / dist
    });
  }

  public static applyWallImpactSquash(ctx: SystemContext): void {
    const transforms = ctx.stores.get<TransformComponent>("transform");
    const pTrans = transforms.get(ctx.refs.player);
    if (pTrans) {
      const squash = GAMEPLAY_TUNING.PLAYER.SQUASH_STRETCH;
      pTrans.scaleX = squash.SQUASH_WALL_X;
      pTrans.scaleY = squash.SQUASH_WALL_Y;
      pTrans.scaleZ = 1.0;
      pTrans.scaleVelX = 0;
      pTrans.scaleVelY = 0;
      pTrans.scaleVelZ = 0;
    }
  }
}
