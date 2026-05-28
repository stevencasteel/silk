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
import { GAMEPLAY_TUNING, ARENA_CONFIG } from "../../../core/engine/ArenaConfig";
import { PlayerStateUtils } from "./PlayerStateUtils";
import { ParallaxScrollSystem } from "../../../visual/systems/ParallaxScrollSystem";
import { getDistance2D } from "../../../core/utils/EngineUtils";

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

    const currentScrollSpeed = ParallaxScrollSystem.currentScrollSpeed;
    const reelConfig = GAMEPLAY_TUNING.REEL;

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

      const stillPressingIn = input.x === trav.wallDir;
      if (!stillPressingIn) {
        PlayerStateUtils.triggerFling(ctx, vel, tether, target, trav);
        return trav.state;
      }

      const halfW = sticky.width / 2;
      const halfH = sticky.height / 2;

      target.x = bugTrans.x - trav.wallDir * (halfW + ARENA_CONFIG.ENTITY.PLAYER_RADIUS);

      let slideSpeed = 0.0;
      if (input.y > 0) {
        slideSpeed = 5.0;
      } else if (input.y < 0) {
        slideSpeed = -5.0;
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

    const stillPressingIn = input.x === trav.wallDir;
    if (!stillPressingIn) {
      PlayerStateUtils.triggerFling(ctx, vel, tether, target, trav);
      return trav.state;
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
