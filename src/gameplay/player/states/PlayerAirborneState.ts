import { IPlayerState } from "../IPlayerState";
import {
  TraversalState,
  KinematicTargetComponent,
  KinematicVelocityComponent,
  TetherComponent,
  TraversalStateComponent,
  InputIntentComponent,
  StickySurfaceComponent,
  TransformComponent
} from "../../../core/ecs/Components";
import { SystemContext } from "../../../core/engine/SystemContext";
import { GAMEPLAY_TUNING, CANONICAL_UNITS, ARENA_CONFIG } from "../../../core/engine/ArenaConfig";
import { PlayerStateUtils } from "./PlayerStateUtils";
import { GameEvent } from "../../../core/events/GameEvents";
import { getDistance2D } from "../../../core/utils/EngineUtils";

export class PlayerAirborneState implements IPlayerState {
  public readonly type: TraversalState = "AIRBORNE";

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

    vel.y += CANONICAL_UNITS.GRAVITY.PLAYER_KINEMATIC * dt;
    vel.x += input.x * tuning.SWING_STEER_FORCE * dt;

    if (input.y > 0 && tether.isAttached) {
      const dxVal = tether.anchorX - target.x;
      const dyVal = tether.anchorY - target.y;
      const dist = getDistance2D(target.x, target.y, tether.anchorX, tether.anchorY);
      const pullForce = 15.0;
      vel.x += (dxVal / dist) * pullForce * dt;
      vel.y += (dyVal / dist) * pullForce * dt;
    }

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
    return null;
  }
}
