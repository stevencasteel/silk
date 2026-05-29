import { SystemContext } from "../../../core/engine/SystemContext";
import {
  KinematicTargetComponent,
  KinematicVelocityComponent,
  TetherComponent,
  TraversalStateComponent,
  TransformComponent,
  ParticleRequestComponent,
  PlayerCosmeticComponent,
  StickySurfaceComponent,
  WallBugComponent,
  CollisionStateComponent,
  InputIntentComponent,
  TraversalState
} from "../../../core/ecs/Components";
import { GAMEPLAY_TUNING, ARENA_CONFIG } from "../../../core/engine/ArenaConfig";
import { getDistance2D } from "../../../core/utils/EngineUtils";
import { GameEvent } from "../../../core/events/GameEvents";
import { LaunchTrailStrategy, WallSparksStrategy, WebSplatStrategy } from "../../juice/ParticleStrategies";

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

    const isSweetSpot =
      storedTension >= reelConfig.SWEET_SPOT_MIN && storedTension <= reelConfig.SWEET_SPOT_MAX;
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
    } else if (storedTension >= GAMEPLAY_TUNING.REEL.SWEET_SPOT_MAX) {
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

  public static handleBugCollisions(
    ctx: SystemContext,
    target: KinematicTargetComponent,
    vel: KinematicVelocityComponent,
    trav: TraversalStateComponent,
    input: InputIntentComponent,
    nextX: number,
    nextY: number,
    isTrapped: boolean,
    currentState: TraversalState
  ): TraversalState | null {
    const stickyStore = ctx.stores.get<StickySurfaceComponent>("stickySurface");
    const bugTransStore = ctx.stores.get<TransformComponent>("transform");
    const bugStore = ctx.stores.get<WallBugComponent>("wallBug");

    if (!stickyStore || !bugTransStore) return null;

    for (const [bugId, sticky] of stickyStore.entries()) {
      if (!sticky.isActive) continue;

      const bugTrans = bugTransStore.get(bugId);
      if (!bugTrans) continue;

      if (trav.lastStickyEntityId !== undefined && trav.lastStickyEntityId === bugId) {
        const halfW = sticky.width / 2;
        const halfH = sticky.height / 2;
        const playerRadius = ARENA_CONFIG.ENTITY.PLAYER_RADIUS;
        const playerHalfHeight = ARENA_CONFIG.ENTITY.PLAYER_HALF_HEIGHT;
        const margin = 1.5;

        const outX = Math.abs(target.x - bugTrans.x) > halfW + playerRadius + margin;
        const outY = Math.abs(target.y - bugTrans.y) > halfH + playerHalfHeight + margin;

        if (outX || outY) {
          trav.lastStickyEntityId = undefined;
        } else {
          continue;
        }
      }

      const halfW = sticky.width / 2;
      const halfH = sticky.height / 2;

      const distToBugX = nextX - bugTrans.x;
      const contactDist = halfW + ARENA_CONFIG.ENTITY.PLAYER_RADIUS + 0.15;

      if (Math.abs(distToBugX) <= contactDist) {
        if (nextY >= bugTrans.y - halfH && nextY <= bugTrans.y + halfH) {
          const bugWallDir = distToBugX > 0 ? -1 : 1;
          const pressingIn = input.x === bugWallDir;

          const bug = bugStore ? bugStore.get(bugId) : undefined;
          const contactedSpikedSide = distToBugX > 0 ? "RIGHT" : "LEFT";

          const inSafeWindow = trav.safeLaunchTimer !== undefined && trav.safeLaunchTimer > 0;
          const spikesActive = bug && bug.spikedSide === contactedSpikedSide && !bug.spikesDisarmed;

          if (spikesActive && !isTrapped && !inSafeWindow) {
            const colStore = ctx.stores.get<CollisionStateComponent>("collisionState");
            const pCol = colStore.get(ctx.refs.player);
            if (pCol) {
              pCol.lastHitType = "WALL";
              pCol.hitPointX = target.x;
              pCol.hitPointY = target.y;
            }

            ctx.commands.dispatch({
              type: "DAMAGE_REQUEST",
              targetId: ctx.refs.player,
              amount: GAMEPLAY_TUNING.COMBAT.SPIKE_DAMAGE,
              source: "BUG_SPIKES",
              knockbackX: -bugWallDir * GAMEPLAY_TUNING.COMBAT.SPIKE_KNOCKBACK_X,
              knockbackY: GAMEPLAY_TUNING.COMBAT.SPIKE_KNOCKBACK_Y
            });

            ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
              amplitude: 0.65,
              duration: 0.35,
              dirX: -bugWallDir,
              dirY: 1.0
            });

            const sparkReqId = ctx.world.create();
            const reqStore = ctx.stores.get<ParticleRequestComponent>("particleRequest");
            if (reqStore) {
              reqStore.add(sparkReqId, {
                strategy: new WallSparksStrategy(-bugWallDir),
                x: target.x,
                y: target.y,
                z: 0
              });
            }

            target.x = bugTrans.x - bugWallDir * (halfW + ARENA_CONFIG.ENTITY.PLAYER_RADIUS + 0.3);
            vel.x = -bugWallDir * GAMEPLAY_TUNING.COMBAT.SPIKE_KNOCKBACK_X;
            vel.y = GAMEPLAY_TUNING.COMBAT.SPIKE_KNOCKBACK_Y;

            return currentState === "LAUNCHING" ? "AIRBORNE" : null;
          }

          if (pressingIn || isTrapped) {
            PlayerStateUtils.applyWallImpactSquash(ctx);

            trav.state = "WALL_SLIDING";
            trav.wallDir = bugWallDir;
            trav.wallNormalX = -bugWallDir;
            trav.wallNormalY = 0;
            trav.stickyEntityId = bugId;
            trav.stickyWallX = bugTrans.x + bugWallDir * (halfW + ARENA_CONFIG.ENTITY.PLAYER_RADIUS);

            const clampedOffsetY = Math.max(-halfH, Math.min(halfH, nextY - bugTrans.y));
            trav.stickyWallYOffset = clampedOffsetY;

            target.x = trav.stickyWallX;
            target.y = bugTrans.y + clampedOffsetY;
            vel.x = 0;
            vel.y = -(9.0 + sticky.speed);

            ctx.broker.publish(GameEvent.PLAYER_WALL_HIT, {
              x: target.x,
              y: target.y,
              wallNormalX: -bugWallDir
            });
            return "WALL_SLIDING";
          } else {
            target.x = bugTrans.x - bugWallDir * (halfW + ARENA_CONFIG.ENTITY.PLAYER_RADIUS);
            if (Math.sign(vel.x) === bugWallDir) {
              vel.x *= -0.2;
            }
            return currentState === "LAUNCHING" ? "AIRBORNE" : null;
          }
        }
      }
    }
    return null;
  }

  public static handleActiveWallBugSpikeCheck(
    ctx: SystemContext,
    vel: KinematicVelocityComponent,
    trav: TraversalStateComponent,
    isTrapped: boolean
  ): boolean {
    if (trav.stickyEntityId !== undefined && trav.stickyEntityId !== -1) {
      const bugStore = ctx.stores.get<WallBugComponent>("wallBug");
      const bug = bugStore ? bugStore.get(trav.stickyEntityId) : undefined;
      const isSpikedOnClingSide =
        bug &&
        !bug.spikesDisarmed &&
        ((trav.wallDir === -1 && bug.spikedSide === "RIGHT") ||
          (trav.wallDir === 1 && bug.spikedSide === "LEFT"));

      const inSafeWindow = trav.safeLaunchTimer !== undefined && trav.safeLaunchTimer > 0;
      if (isSpikedOnClingSide && !isTrapped && !inSafeWindow) {
        trav.state = "AIRBORNE";
        trav.lastStickyEntityId = trav.stickyEntityId;
        trav.stickyEntityId = -1;
        trav.wallDir = 0;

        ctx.commands.dispatch({
          type: "DAMAGE_REQUEST",
          targetId: ctx.refs.player,
          amount: GAMEPLAY_TUNING.COMBAT.SPIKE_DAMAGE,
          source: "BUG_SPIKES",
          knockbackX: trav.wallNormalX * GAMEPLAY_TUNING.COMBAT.SPIKE_KNOCKBACK_X,
          knockbackY: GAMEPLAY_TUNING.COMBAT.SPIKE_KNOCKBACK_Y
        });

        ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
          amplitude: 0.65,
          duration: 0.35,
          dirX: trav.wallNormalX,
          dirY: 1.0
        });

        vel.x = trav.wallNormalX * GAMEPLAY_TUNING.COMBAT.SPIKE_KNOCKBACK_X;
        vel.y = GAMEPLAY_TUNING.COMBAT.SPIKE_KNOCKBACK_Y;
        return true;
      }
    }
    return false;
  }

  public static updateWebStruggle(
    ctx: SystemContext,
    target: KinematicTargetComponent,
    input: InputIntentComponent,
    trav: TraversalStateComponent
  ): void {
    if (!trav.isWebTrapped || !input) return;

    let currentDir: "UP" | "DOWN" | "LEFT" | "RIGHT" | "" = "";
    if (input.x < -0.1) currentDir = "LEFT";
    else if (input.x > 0.1) currentDir = "RIGHT";
    else if (input.y > 0.1) currentDir = "UP";
    else if (input.y < -0.1) currentDir = "DOWN";

    if (currentDir !== "" && currentDir !== trav.lastEscapeDirection) {
      trav.escapeProgress = (trav.escapeProgress || 0) + 1;
      trav.lastEscapeDirection = currentDir;

      ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
        amplitude: 0.18,
        duration: 0.12
      });

      const reqStore = ctx.stores.get<ParticleRequestComponent>("particleRequest");
      if (reqStore) {
        const reqId = ctx.world.create();
        reqStore.add(reqId, {
          strategy: new WebSplatStrategy(),
          x: target.x,
          y: target.y,
          z: 0
        });
      }

      window.dispatchEvent(
        new CustomEvent("silk-web-struggle", {
          detail: {
            progress: trav.escapeProgress,
            required: trav.escapeRequired,
            direction: currentDir
          }
        })
      );

      if (trav.escapeProgress >= (trav.escapeRequired || 5)) {
        trav.isWebTrapped = false;
        trav.escapeProgress = 0;
        trav.lastEscapeDirection = "";
        trav.safeLaunchTimer = 1.5;

        if (trav.state === "WALL_SLIDING") {
          trav.hasFlingBonus = true;
        }

        const pTrans = ctx.stores
          .get<TransformComponent>("transform")
          .get(ctx.refs.player);
        if (pTrans) {
          pTrans.scaleX = 1.4;
          pTrans.scaleY = 1.4;
          pTrans.scaleZ = 1.4;
        }

        ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
          amplitude: 0.8,
          duration: 0.45
        });
        if (reqStore) {
          for (let i = 0; i < 4; i++) {
            const reqId = ctx.world.create();
            reqStore.add(reqId, {
              strategy: new WebSplatStrategy(),
              x: target.x,
              y: target.y,
              z: 0
            });
          }
        }

        window.dispatchEvent(new CustomEvent("silk-web-break"));
      }
    }
  }
}
