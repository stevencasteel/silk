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
  PlayerCosmeticComponent
} from "../../../core/ecs/Components";
import { VISUAL_JUICE_CONFIG } from "../../../core/engine/ArenaConfig";
import { SystemContext } from "../../../core/engine/SystemContext";
import { GAMEPLAY_TUNING, CANONICAL_UNITS, ARENA_CONFIG } from "../../../core/engine/ArenaConfig";
import { PlayerStateUtils } from "./PlayerStateUtils";
import { GameEvent } from "../../../core/events/GameEvents";

export class PlayerLaunchingState implements IPlayerState {
  public readonly type: TraversalState = "LAUNCHING";

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

    const tuning = GAMEPLAY_TUNING.PLAYER;

    const cosmeticStore = ctx.stores.get<PlayerCosmeticComponent>("playerCosmetic");
    const cosmetic = cosmeticStore ? cosmeticStore.get(ctx.refs.player) : undefined;
    if (cosmetic) {
      const stretchFactor = tuning.SQUASH_STRETCH.LAUNCH_POWER_MULT * trav.launchPower;
      cosmetic.targetScaleY = 1.0 + stretchFactor;
      cosmetic.targetScaleX = 1.0 - stretchFactor * 0.5;
      cosmetic.targetScaleZ = 1.0 - stretchFactor * 0.5;
      cosmetic.springStiffness = 220;
      cosmetic.springDamping = 14;

      const vx = vel.x;
      const vy = vel.y;
      cosmetic.rotationAngle = vx * vx + vy * vy > 1.0 ? -Math.atan2(vx, vy) : 0;
      cosmetic.slerpFactor = tuning.SLERP_FACTOR;

      cosmetic.emissiveR = VISUAL_JUICE_CONFIG.EMISSIVE.PLAYER_EMISSIVE_LAUNCH.R;
      cosmetic.emissiveG = VISUAL_JUICE_CONFIG.EMISSIVE.PLAYER_EMISSIVE_LAUNCH.G;
      cosmetic.emissiveB = VISUAL_JUICE_CONFIG.EMISSIVE.PLAYER_EMISSIVE_LAUNCH.B;
    }

    trav.launchTimer -= dt;
    vel.x += input.x * tuning.LAUNCH_STEER_FORCE * dt;
    vel.y += CANONICAL_UNITS.GRAVITY.PLAYER_KINEMATIC * tuning.LAUNCH_GRAVITY_MULT * dt;

    const damp = Math.pow(tuning.DRAG_DAMPING, dt * CANONICAL_UNITS.TEMPORAL.LEGACY_FPS_BASIS);
    vel.x *= damp;
    vel.y *= damp;

    const nextX = target.x + vel.x * dt;
    const nextY = target.y + vel.y * dt;

    const hitRight = nextX > ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;
    const hitLeft = nextX < -ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;
    const wallDir = hitRight ? 1 : hitLeft ? -1 : 0;

    const stickyStore = ctx.stores.get<StickySurfaceComponent>("stickySurface");
    const bugTransStore = ctx.stores.get<TransformComponent>("transform");
    if (stickyStore && bugTransStore) {
      for (const [bugId, sticky] of stickyStore.entries()) {
        if (!sticky.isActive) continue;
        const bugTrans = bugTransStore.get(bugId);
        if (!bugTrans) continue;

        const halfW = sticky.width / 2;
        const halfH = sticky.height / 2;

        const distToBugX = nextX - bugTrans.x;
        const contactDist = halfW + ARENA_CONFIG.ENTITY.PLAYER_RADIUS + 0.15;

        if (Math.abs(distToBugX) <= contactDist) {
          if (nextY >= bugTrans.y - halfH && nextY <= bugTrans.y + halfH) {
            const bugWallDir = distToBugX > 0 ? -1 : 1;
            const pressingIn = input.x === bugWallDir;

            if (pressingIn) {
              PlayerStateUtils.applyWallImpactSquash(ctx);

              trav.state = "WALL_SLIDING";
              trav.wallDir = bugWallDir;
              trav.wallNormalX = -bugWallDir;
              trav.wallNormalY = 0;
              trav.stickyEntityId = bugId;
              trav.stickyWallX =
                bugTrans.x + bugWallDir * (halfW + ARENA_CONFIG.ENTITY.PLAYER_RADIUS);
              trav.stickyWallYOffset = nextY - bugTrans.y;

              target.x = trav.stickyWallX;
              target.y = nextY;
              vel.x = 0;
              vel.y = -(9.0 + sticky.speed);

              ctx.broker.publish(GameEvent.PLAYER_WALL_HIT, {
                x: target.x,
                y: target.y,
                wallNormalX: -bugWallDir
              });
              return "WALL_SLIDING";
            }
          }
        }
      }
    }

    if (wallDir !== 0) {
      const pressingIn = input.x === wallDir;
      if (pressingIn) {
        PlayerStateUtils.applyWallImpactSquash(ctx);
        trav.state = "WALL_SLIDING";
        trav.wallDir = wallDir;
        trav.wallNormalX = -wallDir;
        trav.wallNormalY = 0;
        trav.stickyEntityId = -1;

        target.x = wallDir * ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;
        target.y = nextY;
        vel.x = 0;
        vel.y = -9.0;

        ctx.broker.publish(GameEvent.PLAYER_WALL_HIT, {
          x: target.x,
          y: target.y,
          wallNormalX: -wallDir
        });
        return "WALL_SLIDING";
      } else {
        target.x = wallDir * ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;
        target.y = nextY;
        if (Math.sign(vel.x) === wallDir) {
          vel.x *= -0.2;
        }
        return null;
      }
    }

    target.x = nextX;
    target.y = nextY;

    if (trav.launchTimer <= 0) {
      trav.state = "AIRBORNE";
      return "AIRBORNE";
    }

    return null;
  }
}
