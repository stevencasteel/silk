import { IPlayerState } from "../IPlayerState";
import {
  TraversalState,
  KinematicTargetComponent,
  KinematicVelocityComponent,
  TetherComponent,
  TraversalStateComponent,
  InputIntentComponent,
  StickySurfaceComponent,
  TransformComponent,
  PlayerCosmeticComponent,
  ParticleRequestComponent,
  WallBugComponent
} from "../../../core/ecs/Components";
import { VISUAL_JUICE_CONFIG } from "../../../core/engine/ArenaConfig";
import { SystemContext } from "../../../core/engine/SystemContext";
import { GAMEPLAY_TUNING, ARENA_CONFIG } from "../../../core/engine/ArenaConfig";
import { PlayerStateUtils } from "./PlayerStateUtils";
import { ParallaxScrollSystem } from "../../../visual/systems/ParallaxScrollSystem";
import { getDistance2D } from "../../../core/utils/EngineUtils";
import { WallSlideSparksStrategy } from "../../juice/ParticleStrategies";
import { GameEvent } from "../../../core/events/GameEvents";

export class PlayerWallSlidingState implements IPlayerState {
  public readonly type: TraversalState = "WALL_SLIDING";

  public enter(ctx: SystemContext): void {
    void ctx;
  }

  public exit(ctx: SystemContext): void {
    void ctx;
  }

  public update(ctx: SystemContext, dt: number): TraversalState | null {
    const target = ctx.stores.get<KinematicTargetComponent>("target").get(ctx.refs.player);
    const vel = ctx.stores.get<KinematicVelocityComponent>("velocity").get(ctx.refs.player);
    const tether = ctx.stores.get<TetherComponent>("tether").get(ctx.refs.player);
    const input = ctx.stores.get<InputIntentComponent>("input").get(ctx.refs.player);
    const trav = ctx.stores.get<TraversalStateComponent>("traversal").get(ctx.refs.player);

    if (!target || !vel || !tether || !input || !trav) return null;

    const isTrapped = !!trav.isWebTrapped;

    // Critical Penalty Exception: If player is attached to spiked side and breaks free, fling them off!
    if (trav.stickyEntityId !== undefined && trav.stickyEntityId !== -1) {
      const bugStore = ctx.stores.get<WallBugComponent>("wallBug");
      const bug = bugStore ? bugStore.get(trav.stickyEntityId) : undefined;
      const isSpikedOnClingSide = bug && (
        (trav.wallDir === -1 && bug.spikedSide === "RIGHT") ||
        (trav.wallDir === 1 && bug.spikedSide === "LEFT")
      );

      if (isSpikedOnClingSide && !isTrapped) {
        trav.state = "AIRBORNE";
        trav.stickyEntityId = -1;
        trav.wallDir = 0;

        ctx.commands.dispatch({
          type: "DAMAGE_REQUEST",
          targetId: ctx.refs.player,
          amount: GAMEPLAY_TUNING.COMBAT.SPIKE_DAMAGE,
          source: "BUG_SPIKES",
          knockbackX: -trav.wallNormalX * GAMEPLAY_TUNING.COMBAT.SPIKE_KNOCKBACK_X,
          knockbackY: GAMEPLAY_TUNING.COMBAT.SPIKE_KNOCKBACK_Y
        });

        ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
          amplitude: 0.65,
          duration: 0.35,
          dirX: -trav.wallNormalX,
          dirY: 1.0
        });

        vel.x = -trav.wallNormalX * GAMEPLAY_TUNING.COMBAT.SPIKE_KNOCKBACK_X;
        vel.y = GAMEPLAY_TUNING.COMBAT.SPIKE_KNOCKBACK_Y;
        return "AIRBORNE";
      }
    }

    const cosmeticStore = ctx.stores.get<PlayerCosmeticComponent>("playerCosmetic");
    const cosmetic = cosmeticStore ? cosmeticStore.get(ctx.refs.player) : undefined;
    if (cosmetic) {
      const tuning = GAMEPLAY_TUNING.PLAYER;
      cosmetic.targetScaleX = tuning.SQUASH_STRETCH.WALL_SLIDE_X;
      cosmetic.targetScaleY = tuning.SQUASH_STRETCH.WALL_SLIDE_Y;
      cosmetic.targetScaleZ = tuning.SQUASH_STRETCH.WALL_SLIDE_Z;
      cosmetic.springStiffness = 220;
      cosmetic.springDamping = 14;

      cosmetic.rotationAngle = 0;
      cosmetic.slerpFactor = tuning.SLERP_FACTOR;

      cosmetic.emissiveR =
        VISUAL_JUICE_CONFIG.EMISSIVE.PLAYER_EMISSIVE_SLIDE.BASE_R +
        Math.min(1.0, tether.tension) * VISUAL_JUICE_CONFIG.EMISSIVE.PLAYER_EMISSIVE_SLIDE.RANGE_R;
      cosmetic.emissiveG =
        VISUAL_JUICE_CONFIG.EMISSIVE.PLAYER_EMISSIVE_SLIDE.BASE_G +
        (1.0 - Math.min(1.0, tether.tension)) *
          VISUAL_JUICE_CONFIG.EMISSIVE.PLAYER_EMISSIVE_SLIDE.RANGE_G;
      cosmetic.emissiveB =
        (1.0 - Math.min(1.0, tether.tension)) *
        VISUAL_JUICE_CONFIG.EMISSIVE.PLAYER_EMISSIVE_SLIDE.MULT_B;
    }

    const currentScrollSpeed = ParallaxScrollSystem.currentScrollSpeed;
    const reelConfig = GAMEPLAY_TUNING.REEL;

    const sparkReqId = ctx.world.create();
    const reqStore = ctx.stores.get<ParticleRequestComponent>("particleRequest");
    if (reqStore) {
      reqStore.add(sparkReqId, {
        strategy: new WallSlideSparksStrategy(trav.wallNormalX, tether.tension, dt),
        x: trav.wallDir * target.x,
        y: target.y,
        z: 0
      });
    }

    const stillPressingIn = input.x === trav.wallDir;
    const webMass = trav.webMass || 1;
    const controlFactor = isTrapped ? Math.max(0.1, 0.5 - (webMass - 1) * 0.1) : 1.0;

    if (!stillPressingIn && !isTrapped) {
      PlayerStateUtils.triggerFling(ctx, vel, tether, target, trav);
      return trav.state;
    }

    if (trav.stickyEntityId !== undefined && trav.stickyEntityId !== -1) {
      const stickyStore = ctx.stores.get<StickySurfaceComponent>("stickySurface");
      const sticky = stickyStore ? stickyStore.get(trav.stickyEntityId) : undefined;
      const bugTransStore = ctx.stores.get<TransformComponent>("transform");
      const bugTrans = bugTransStore.get(trav.stickyEntityId);

      if (!sticky || !sticky.isActive || !bugTrans || trav.stickyWallYOffset === undefined) {
        trav.state = "AIRBORNE";
        trav.stickyEntityId = -1;
        trav.wallDir = 0;
        return "AIRBORNE";
      }

      const halfW = sticky.width / 2;
      const halfH = sticky.height / 2;

      target.x = bugTrans.x - trav.wallDir * (halfW + ARENA_CONFIG.ENTITY.PLAYER_RADIUS);

      let slideSpeed = 0.0;
      if (input.y > 0) {
        slideSpeed = 5.0 * controlFactor;
      } else if (input.y < 0) {
        slideSpeed = -5.0 * controlFactor;
      }
      trav.stickyWallYOffset += slideSpeed * dt;
      trav.stickyWallYOffset = Math.max(-halfH, Math.min(halfH, trav.stickyWallYOffset));

      const finalY = bugTrans.y + trav.stickyWallYOffset;
      const requiredLength = getDistance2D(target.x, finalY, tether.anchorX, tether.anchorY);

      if (input.y <= 0 && requiredLength > tether.maxLength) {
        const maxAllowed = GAMEPLAY_TUNING.REEL.MAX_LENGTH;
        if (tether.maxLength < maxAllowed) {
          tether.maxLength = Math.min(maxAllowed, requiredLength);
          tether.desiredLength = Math.max(tether.desiredLength, tether.maxLength);
        }
      }
      target.y = finalY;

      vel.x = 0;
      vel.y = -(currentScrollSpeed + sticky.speed - slideSpeed);

      const speedScale = 1.0 + sticky.speed / Math.max(1.0, currentScrollSpeed);
      const tensionDelta = reelConfig.WALL_SLIDE_PASSIVE_TENSION_RATE * speedScale;
      tether.tension += tensionDelta * dt;

      return null;
    }

    target.x = trav.wallDir * ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;
    vel.x = 0;
    vel.y = -currentScrollSpeed;

    const finalY = target.y + vel.y * dt;
    const requiredLength = getDistance2D(target.x, finalY, tether.anchorX, tether.anchorY);

    if (input.y <= 0 && requiredLength > tether.maxLength) {
      const maxAllowed = GAMEPLAY_TUNING.REEL.MAX_LENGTH;
      if (tether.maxLength < maxAllowed) {
        tether.maxLength = Math.min(maxAllowed, requiredLength);
        tether.desiredLength = Math.max(tether.desiredLength, tether.maxLength);
      }
    }
    target.y = finalY;
    return null;
  }
}
