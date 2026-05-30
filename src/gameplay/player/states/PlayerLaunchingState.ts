import { IPlayerState } from "../IPlayerState";
import {
  TraversalState,
  KinematicTargetComponent,
  KinematicVelocityComponent,
  TetherComponent,
  TraversalStateComponent,
  InputIntentComponent,
  PlayerCosmeticComponent,
  ParticleRequestComponent
} from "../../../core/ecs/Components";
import { VISUAL_JUICE_CONFIG } from "../../../core/engine/ArenaConfig";
import { SystemContext } from "../../../core/engine/SystemContext";
import { GAMEPLAY_TUNING, CANONICAL_UNITS, ARENA_CONFIG } from "../../../core/engine/ArenaConfig";
import { PlayerStateUtils } from "./PlayerStateUtils";
import { LAUNCH_TRAIL_STRATEGY } from "../../juice/ParticleStrategies";

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
    const isTrapped = !!trav.isWebTrapped;
    const webMass = trav.webMass || 1;
    const trappedDamping = isTrapped ? Math.max(0.1, 0.5 - (webMass - 1) * 0.1) : 1.0;
    const recoilFactor = (trav.recoilTimer !== undefined && trav.recoilTimer > 0) ? 0.15 : 1.0;

    const cosmeticStore = ctx.stores.get<PlayerCosmeticComponent>("playerCosmetic");
    const cosmetic = cosmeticStore ? cosmeticStore.get(ctx.refs.player) : undefined;
    if (cosmetic) {
      const stretchFactor = tuning.SQUASH_STRETCH.LAUNCH_POWER_MULT * trav.launchPower;
      cosmetic.targetScaleX = 1.0 - stretchFactor * 0.5;
      cosmetic.targetScaleY = 1.0 + stretchFactor;
      cosmetic.targetScaleZ = 1.0 - stretchFactor * 0.5;
      cosmetic.springStiffness = 250;
      cosmetic.springDamping = 9;

      const vx = vel.x;
      const vy = vel.y;
      cosmetic.rotationAngle = vx * vx + vy * vy > 1.0 ? -Math.atan2(vx, vy) : 0;
      cosmetic.slerpFactor = tuning.SLERP_FACTOR;

      cosmetic.emissiveR = VISUAL_JUICE_CONFIG.EMISSIVE.PLAYER_EMISSIVE_LAUNCH.R;
      cosmetic.emissiveG = VISUAL_JUICE_CONFIG.EMISSIVE.PLAYER_EMISSIVE_LAUNCH.G;
      cosmetic.emissiveB = VISUAL_JUICE_CONFIG.EMISSIVE.PLAYER_EMISSIVE_LAUNCH.B;
    }

    trav.launchTimer -= dt;
    vel.x += input.x * tuning.LAUNCH_STEER_FORCE * trappedDamping * recoilFactor * dt;
    vel.y += CANONICAL_UNITS.GRAVITY.PLAYER_KINEMATIC * tuning.LAUNCH_GRAVITY_MULT * dt;

    const damp = Math.pow(tuning.DRAG_DAMPING, dt * CANONICAL_UNITS.TEMPORAL.LEGACY_FPS_BASIS);
    vel.x *= damp;
    vel.y *= damp;

    const nextX = target.x + vel.x * dt;
    const nextY = target.y + vel.y * dt;

    const hitRight = nextX > ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;
    const hitLeft = nextX < -ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;
    const wallDir = hitRight ? 1 : hitLeft ? -1 : 0;

    const bugStateResult = PlayerStateUtils.handleBugCollisions(
      ctx,
      target,
      vel,
      trav,
      input,
      nextX,
      nextY,
      isTrapped,
      this.type
    );
    if (bugStateResult !== null) {
      return bugStateResult;
    }

    if (wallDir !== 0) {
      const pressingIn = input.x === wallDir;
      if (pressingIn || isTrapped) {
        PlayerStateUtils.applyWallImpactSquash(ctx);
        trav.state = "WALL_STICKING";
        trav.wallDir = wallDir;
        trav.wallNormalX = -wallDir;
        trav.wallNormalY = 0;
        trav.stickyEntityId = -1;

        target.x = wallDir * ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;
        target.y = nextY;
        vel.x = 0;
        vel.y = -9.0;

        return "WALL_STICKING";
      } else {
        target.x = wallDir * ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;
        target.y = nextY;
        if (Math.sign(vel.x) === wallDir) {
          vel.x *= -0.2;
        }
        return "AIRBORNE";
      }
    }

    target.x = nextX;
    target.y = nextY;

    const reqId = ctx.world.create();
    const reqStore = ctx.stores.get<ParticleRequestComponent>("particleRequest");
    if (reqStore) {
      reqStore.add(reqId, {
        strategy: LAUNCH_TRAIL_STRATEGY,
        x: target.x,
        y: target.y,
        z: 0
      });
    }

    if (trav.launchTimer <= 0) {
      trav.state = "AIRBORNE";
      return "AIRBORNE";
    }

    return null;
  }
}
