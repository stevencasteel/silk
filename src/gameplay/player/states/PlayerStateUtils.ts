import { SystemContext } from "../../../core/engine/SystemContext";
import {
  HitStopComponent,
  KinematicTargetComponent,
  KinematicVelocityComponent,
  TetherComponent,
  TraversalStateComponent,
  TransformComponent,
  ParticleRequestComponent,
  PlayerCosmeticComponent,
  StickySurfaceComponent,
  WallBugComponent,
  HealthBugComponent,
  CollisionStateComponent,
  InputIntentComponent,
  TraversalState
} from "../../../core/ecs/Components";
import { GAMEPLAY_TUNING, ARENA_CONFIG, VISUAL_JUICE_CONFIG } from "../../../core/engine/ArenaConfig";
import { getDistance2D } from "../../../core/utils/EngineUtils";
import { GameEvent } from "../../../core/events/GameEvents";
import { LaunchTrailStrategy, WallSparksStrategy, WebSplatStrategy } from "../../juice/ParticleStrategies";
import { EngineTime } from "../../../core/engine/EngineTime";

export class PlayerStateUtils {
  public static enforcePendulumConstraint(
    target: KinematicTargetComponent,
    vel: KinematicVelocityComponent,
    tether: TetherComponent
  ): void {
    const dx = target.x - tether.anchorX;
    const dy = target.y - tether.anchorY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 0.001) return;

    const activeMaxLength = tether.maxLength;

    if (dist > activeMaxLength) {
      const nx = dx / dist;
      const ny = dy / dist;

      target.x = tether.anchorX + nx * activeMaxLength;
      target.y = tether.anchorY + ny * activeMaxLength;

      const radialVel = vel.x * nx + vel.y * ny;

      if (radialVel > 0) {
        const initialSpeed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

        vel.x -= radialVel * nx;
        vel.y -= radialVel * ny;

        const tangentSpeed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        if (tangentSpeed > 0.01 && initialSpeed > tangentSpeed) {
          const restoreRatio = initialSpeed / tangentSpeed;
          const clampRatio = Math.min(restoreRatio, 1.05);
          vel.x *= clampRatio;
          vel.y *= clampRatio;
        }
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
    const reelConfig = GAMEPLAY_TUNING.REEL;
    const tuning = GAMEPLAY_TUNING.PLAYER;

    const launchedFromBug = trav.stickyEntityId !== undefined && trav.stickyEntityId !== -1;
    if (launchedFromBug) {
      trav.lastStickyEntityId = trav.stickyEntityId;
      trav.safeLaunchTimer = 0.4;
    }
    trav.stickyEntityId = -1;

    if (storedTension < reelConfig.SWEET_SPOT_MIN) {
      tether.tension = 0.0;
      trav.state = "AIRBORNE";
      trav.launchPower = 0.05;
      trav.launchTimer = 0;
      
      const nudgeDistance = 0.35;
      target.x += trav.wallNormalX * nudgeDistance;
      vel.x = trav.wallNormalX * 5.5;
      vel.y = Math.max(vel.y, -3.0);
      
      trav.wallDir = 0;
      trav.safeLaunchTimer = Math.max(trav.safeLaunchTimer || 0, 0.4);

      const cosmeticStore = ctx.stores.get<PlayerCosmeticComponent>("playerCosmetic");
      const pCosmetic = cosmeticStore ? cosmeticStore.get(ctx.refs.player) : undefined;
      if (pCosmetic) {
        pCosmetic.emissiveR = VISUAL_JUICE_CONFIG.EMISSIVE.PLAYER_EMISSIVE_DEFAULT.R;
        pCosmetic.emissiveG = VISUAL_JUICE_CONFIG.EMISSIVE.PLAYER_EMISSIVE_DEFAULT.G;
        pCosmetic.emissiveB = VISUAL_JUICE_CONFIG.EMISSIVE.PLAYER_EMISSIVE_DEFAULT.B;
        pCosmetic.targetScaleX = 1.0;
        pCosmetic.targetScaleY = 1.0;
        pCosmetic.targetScaleZ = 1.0;
      }
      return;
    }

    const dx = tether.anchorX - target.x;
    const dy = tether.anchorY - target.y;
    const dist = getDistance2D(target.x, target.y, tether.anchorX, tether.anchorY);

    const isSweetSpot =
      storedTension >= reelConfig.SWEET_SPOT_MIN && storedTension <= reelConfig.SWEET_SPOT_MAX;
    const isOverload = storedTension > reelConfig.SWEET_SPOT_MAX;

    const minT = reelConfig.SWEET_SPOT_MIN;
    const maxT = 1.3;
    const rangeFactor = Math.max(0, Math.min(1.0, (storedTension - minT) / (maxT - minT)));
    
    const minMult = 0.35;
    const maxMult = 2.2;
    const speedMultiplier = minMult + (maxMult - minMult) * Math.pow(rangeFactor, 1.5);

    const bonusMultiplier = trav.hasFlingBonus ? 1.15 : 1.0;
    const power = tuning.FLING_IMPULSE * speedMultiplier * bonusMultiplier;
    const powerScale = storedTension;

    vel.x = (dx / dist) * power;
    vel.y = (dy / dist) * power;

    trav.state = "LAUNCHING";
    trav.launchTimer = tuning.LAUNCH_DURATION;
    trav.launchPower = powerScale;
    trav.wallDir = 0;

    tether.tension = 0.0;

    const transforms = ctx.stores.get<TransformComponent>("transform");
    const pTrans = transforms.get(ctx.refs.player);
    if (pTrans) {
      if (isOverload) {
        pTrans.scaleVelY = 36.0;
        pTrans.scaleVelX = -18.0;
        pTrans.scaleVelZ = -18.0;
        const hs = ctx.stores.get<HitStopComponent>("hitStop").get(ctx.refs.player);
        if (hs) hs.timeRemaining = 0.10;
      } else if (isSweetSpot) {
        pTrans.scaleVelY = 22.0;
        pTrans.scaleVelX = -11.0;
        pTrans.scaleVelZ = -11.0;
        EngineTime.hitLagTimer = 0.08;
        EngineTime.hitLagScale = 0.15;
      } else {
        pTrans.scaleVelY = powerScale * 15.0;
        pTrans.scaleVelX = -powerScale * 7.5;
        pTrans.scaleVelZ = -powerScale * 7.5;
      }
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
    const velocities = ctx.stores.get<KinematicVelocityComponent>("velocity");
    const pTrans = transforms.get(ctx.refs.player);
    const pVel = velocities.get(ctx.refs.player);

    if (pTrans && pVel) {
      const squash = GAMEPLAY_TUNING.PLAYER.SQUASH_STRETCH;
      const impactSpeed = Math.abs(pVel.x);
      const impactFactor = Math.min(1.0, impactSpeed / 50.0);

      pTrans.scaleX = Math.max(0.3, squash.SQUASH_WALL_X - impactFactor * 0.35);
      pTrans.scaleY = Math.min(2.0, squash.SQUASH_WALL_Y + impactFactor * 0.5);
      pTrans.scaleZ = 1.0;

      pTrans.scaleVelX = 15.0 + impactFactor * 55.0; 
      pTrans.scaleVelY = -(15.0 + impactFactor * 55.0);
      pTrans.scaleZ = 1.0;
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
    _isTrapped: boolean,
    currentState: TraversalState
  ): TraversalState | null {
    const stickyStore = ctx.stores.get<StickySurfaceComponent>("stickySurface");
    const bugTransStore = ctx.stores.get<TransformComponent>("transform");
    const bugStore = ctx.stores.get<WallBugComponent>("wallBug");
    const hBugStore = ctx.stores.get<HealthBugComponent>("healthBug");

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
          const hBug = hBugStore ? hBugStore.get(bugId) : undefined;
          const contactedSpikedSide = distToBugX > 0 ? "RIGHT" : "LEFT";

          const isPlayerTrapped = trav.isWebTrapped;
          const isWebShieldActive = hBug ? (hBug.isWebTrapped || isPlayerTrapped) : isPlayerTrapped;
          const inSafeWindow = trav.safeLaunchTimer !== undefined && trav.safeLaunchTimer > 0;

          let spikesActive = false;
          if (bug) {
            spikesActive = bug.spikedSide === contactedSpikedSide && !bug.spikesDisarmed;
          } else if (hBug) {
            if (!hBug.spikesDisarmed) {
              if (hBug.variant === "SPIKED_LEFT" && distToBugX < 0) {
                spikesActive = true;
              } else if (hBug.variant === "SPIKED_RIGHT" && distToBugX > 0) {
                spikesActive = true;
              } else if (hBug.variant === "SPIKED_TOP" && nextY > bugTrans.y) {
                spikesActive = true;
              } else if (hBug.variant === "SPIKED_BOTTOM" && nextY < bugTrans.y) {
                spikesActive = true;
              }
            }
          }

          if (spikesActive && !isWebShieldActive && !inSafeWindow) {
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

          if (pressingIn || isPlayerTrapped) {
            PlayerStateUtils.applyWallImpactSquash(ctx);

            trav.state = "WALL_STICKING";
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
            return "WALL_STICKING";
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
    trav: TraversalStateComponent
  ): boolean {
    if (trav.stickyEntityId !== undefined && trav.stickyEntityId !== -1) {
      const bugStore = ctx.stores.get<WallBugComponent>("wallBug");
      const hBugStore = ctx.stores.get<HealthBugComponent>("healthBug");
      
      const bug = bugStore ? bugStore.get(trav.stickyEntityId) : undefined;
      const hBug = hBugStore ? hBugStore.get(trav.stickyEntityId) : undefined;

      const isPlayerTrapped = trav.isWebTrapped;
      const isWebShieldActive = hBug ? (hBug.isWebTrapped || isPlayerTrapped) : isPlayerTrapped;

      let isSpikedOnClingSide = false;
      if (bug && !bug.spikesDisarmed) {
        isSpikedOnClingSide = (trav.wallDir === -1 && bug.spikedSide === "RIGHT") ||
                             (trav.wallDir === 1 && bug.spikedSide === "LEFT");
      } else if (hBug && !hBug.spikesDisarmed) {
        isSpikedOnClingSide = (trav.wallDir === -1 && hBug.variant === "SPIKED_RIGHT") ||
                             (trav.wallDir === 1 && hBug.variant === "SPIKED_LEFT");
      }

      const inSafeWindow = trav.safeLaunchTimer !== undefined && trav.safeLaunchTimer > 0;
      if (isSpikedOnClingSide && !isWebShieldActive && !inSafeWindow) {
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

        if (trav.state === "WALL_STICKING") {
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
