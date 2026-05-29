import { SystemContext } from "../../../core/engine/SystemContext";
import {
  KinematicTargetComponent,
  KinematicVelocityComponent,
  TetherComponent,
  TraversalStateComponent,
  TransformComponent,
  ParticleRequestComponent,
  PlayerCosmeticComponent
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

    const launchedFromBug = trav.stickyEntityId !== undefined && trav.stickyEntityId !== -1;
    if (launchedFromBug) {
      trav.lastStickyEntityId = trav.stickyEntityId;
      trav.safeLaunchTimer = 0.4;
    }
    trav.stickyEntityId = -1;

    if (storedTension < tuning.MIN_FLING_TENSION) {
      trav.state = "AIRBORNE";
      trav.wallDir = 0;
      trav.safeLaunchTimer = Math.max(trav.safeLaunchTimer || 0, 0.4);
      trav.launchPower = 0;
      return;
    }

    const dx = tether.anchorX - target.x;
    const dy = tether.anchorY - target.y;
    const dist = getDistance2D(target.x, target.y, tether.anchorX, tether.anchorY);

    const isSweetSpot = storedTension >= reelConfig.SWEET_SPOT_MIN && storedTension <= reelConfig.SWEET_SPOT_MAX;
    const isOverload = storedTension > reelConfig.SWEET_SPOT_MAX;

    let speedMultiplier = 0.65;
    if (isSweetSpot) {
      speedMultiplier = 1.38;
    } else if (isOverload) {
      speedMultiplier = 1.78;
    }

    const bonusMultiplier = trav.hasFlingBonus ? 1.15 : 1.0;
    const power = tuning.FLING_IMPULSE * speedMultiplier * bonusMultiplier;
    const powerScale = storedTension;

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

    const cosmeticStore = ctx.stores.get<PlayerCosmeticComponent>("playerCosmetic");
    const pCosmetic = cosmeticStore ? cosmeticStore.get(ctx.refs.player) : undefined;
    if (pCosmetic) {
      if (isOverload) {
        pCosmetic.emissiveR = 4.0;
        pCosmetic.emissiveG = 0.1;
        pCosmetic.emissiveB = 0.1;
        pCosmetic.targetScaleX = 0.45;
        pCosmetic.targetScaleY = 1.75;
        pCosmetic.targetScaleZ = 0.45;
      } else if (isSweetSpot) {
        pCosmetic.emissiveR = 3.5;
        pCosmetic.emissiveG = 3.5;
        pCosmetic.emissiveB = 3.5;
        pCosmetic.targetScaleX = 0.55;
        pCosmetic.targetScaleY = 1.65;
        pCosmetic.targetScaleZ = 0.55;
      } else {
        pCosmetic.emissiveR = 0.1;
        pCosmetic.emissiveG = 0.4;
        pCosmetic.emissiveB = 0.8;
        pCosmetic.targetScaleX = 0.95;
        pCosmetic.targetScaleY = 1.05;
        pCosmetic.targetScaleZ = 0.95;
      }
    }

    let shakeAmp = 0.25 + powerScale * 0.35;
    let shakeDur = 0.2;

    if (trav.hasFlingBonus) {
      trav.hasFlingBonus = false;
      shakeAmp += 0.5;
      shakeDur += 0.25;

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
