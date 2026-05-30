import { LANDING_DUST_STRATEGY } from "../juice/ParticleStrategies";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { GameEvent } from "../../core/events/GameEvents";
import {
  KinematicTargetComponent,
  TransformComponent,
  KinematicVelocityComponent,
  TraversalStateComponent,
  ParticleRequestComponent
} from "../../core/ecs/Components";
import { SpatialPartitionService } from "../../core/engine/SpatialPartitionService";
import { ARENA_CONFIG, GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";

export class VerticalBoundarySystem implements ISystem {
  readonly phase = SystemPhase.Collision;
  private readonly PLAYER_HALF_HEIGHT = ARENA_CONFIG.ENTITY.PLAYER_HALF_HEIGHT;

  constructor(private context: SystemContext) {}

  public update(): void {
    const target = this.context.stores
      .get<KinematicTargetComponent>("target")
      .get(this.context.refs.player);
    const vel = this.context.stores
      .get<KinematicVelocityComponent>("velocity")
      .get(this.context.refs.player);
    const trav = this.context.stores
      .get<TraversalStateComponent>("traversal")
      .get(this.context.refs.player);

    if (!target || !vel || !trav) return;

    this.clampToArenaBounds(target, vel, trav);
  }

  private clampToArenaBounds(
    target: KinematicTargetComponent,
    vel: KinematicVelocityComponent,
    trav: TraversalStateComponent
  ): void {
    const minY = SpatialPartitionService.FLOOR_Y + this.PLAYER_HALF_HEIGHT;
    const maxY = SpatialPartitionService.CEILING_Y - this.PLAYER_HALF_HEIGHT;
    const tuning = GAMEPLAY_TUNING.PLAYER;

    const isWallSticking = trav.state === "WALL_STICKING";

    if (target.y < minY) {
      if (isWallSticking) {
        const absoluteFloor = SpatialPartitionService.FLOOR_Y - 70.0;
        if (target.y < absoluteFloor) {
          target.y = absoluteFloor;
          vel.y = Math.max(0, vel.y);
        }
      } else {
        if (vel.y < tuning.SQUASH_STRETCH.LAND_VEL_THRESHOLD) {
          this.context.broker.publish(GameEvent.PLAYER_LANDED, { x: target.x, y: minY });

          // Spawn landing particles purely via ECS component
          const reqId = this.context.world.create();
          const reqStore = this.context.stores.get<ParticleRequestComponent>("particleRequest");
          if (reqStore) {
            reqStore.add(reqId, {
              strategy: LANDING_DUST_STRATEGY,
              x: target.x,
              y: minY,
              z: 0
            });
          }

          const transforms = this.context.stores.get<TransformComponent>("transform");
          const pTrans = transforms.get(this.context.refs.player);

          if (pTrans) {
            const squash = GAMEPLAY_TUNING.PLAYER.SQUASH_STRETCH;
            pTrans.scaleX = squash.SQUASH_LAND_X;
            pTrans.scaleY = squash.SQUASH_LAND_Y;
            pTrans.scaleZ = squash.SQUASH_LAND_Z;
            pTrans.scaleVelX = -15.0;
            pTrans.scaleVelY = 20.0;
            pTrans.scaleVelZ = -15.0;
          }
        }
        target.y = minY;
        vel.y = Math.max(0, vel.y);
      }
    } else if (target.y > maxY) {
      target.y = maxY;
      vel.y = Math.min(0, vel.y);
    }
  }
}
