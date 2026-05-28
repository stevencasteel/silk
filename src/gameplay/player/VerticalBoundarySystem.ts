import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { GameEvent } from "../../core/events/GameEvents";
import {
  TetherComponent,
  KinematicTargetComponent,
  HealthComponent,
  TransformComponent,
  KinematicVelocityComponent,
  TraversalStateComponent,
  TetherStrainComponent
} from "../../core/ecs/Components";
import { ARENA_CONFIG, CANONICAL_UNITS, GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";

export class VerticalBoundarySystem implements ISystem {
  readonly phase = SystemPhase.Collision;
  private readonly FLOOR_Y = ARENA_CONFIG.VERTICAL.FLOOR_Y;
  private readonly CEILING_Y = ARENA_CONFIG.VERTICAL.CEILING_Y;
  private readonly PLAYER_HALF_HEIGHT = ARENA_CONFIG.ENTITY.PLAYER_HALF_HEIGHT;

  private readonly OVERLOAD_THRESHOLD = CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT;
  private readonly SNAP_LIMIT = CANONICAL_UNITS.TETHER_STRAIN.SNAP_LIMIT;

  constructor(private context: SystemContext) {}

  public update(): void {
    const tether = this.context.stores.get<TetherComponent>("tether").get(this.context.refs.player);
    const target = this.context.stores
      .get<KinematicTargetComponent>("target")
      .get(this.context.refs.player);
    const health = this.context.stores.get<HealthComponent>("health").get(this.context.refs.player);
    const vel = this.context.stores
      .get<KinematicVelocityComponent>("velocity")
      .get(this.context.refs.player);
    const trav = this.context.stores
      .get<TraversalStateComponent>("traversal")
      .get(this.context.refs.player);
    const strainStore = this.context.stores.get<TetherStrainComponent>("tetherStrain");

    if (!tether || !target || !health || !vel || !trav) return;

    const pId = this.context.refs.player;
    if (!strainStore.has(pId)) {
      strainStore.add(pId, { strain: 0, strainTimer: 0, isOverloaded: false });
    }
    const tStrain = strainStore.get(pId)!;

    this.clampToArenaBounds(target, vel, trav);
    this.updateStrainMeter(tether, health, tStrain);
  }

  private clampToArenaBounds(
    target: KinematicTargetComponent,
    vel: KinematicVelocityComponent,
    trav: TraversalStateComponent
  ): void {
    const minY = this.FLOOR_Y + this.PLAYER_HALF_HEIGHT;
    const maxY = this.CEILING_Y - this.PLAYER_HALF_HEIGHT;
    const tuning = GAMEPLAY_TUNING.PLAYER;

    const isWallSliding = trav.state === "WALL_SLIDING";

    if (target.y < minY) {
      if (isWallSliding) {
        const absoluteFloor = this.FLOOR_Y - 70.0;
        if (target.y < absoluteFloor) {
          target.y = absoluteFloor;
          vel.y = Math.max(0, vel.y);
        }
      } else {
        if (vel.y < tuning.SQUASH_STRETCH.LAND_VEL_THRESHOLD) {
          this.context.broker.publish(GameEvent.PLAYER_LANDED, { x: target.x, y: minY });
          const transforms = this.context.stores.get<TransformComponent>("transform");
          const pTrans = transforms.get(this.context.refs.player);

          if (pTrans) {
            const squash = GAMEPLAY_TUNING.PLAYER.SQUASH_STRETCH;
            pTrans.scaleX = squash.SQUASH_LAND_X;
            pTrans.scaleY = squash.SQUASH_LAND_Y;
            pTrans.scaleZ = squash.SQUASH_LAND_Z;
            pTrans.scaleVelX = 0;
            pTrans.scaleVelY = 0;
            pTrans.scaleVelZ = 0;
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

  private updateStrainMeter(tether: TetherComponent, health: HealthComponent, tStrain: TetherStrainComponent): void {
    const isOverloaded = tether.tension >= this.OVERLOAD_THRESHOLD;
    tStrain.isOverloaded = isOverloaded;
    tStrain.strain = tether.tension;

    if (isOverloaded) {
      const overloadDelta = tether.tension - this.OVERLOAD_THRESHOLD;
      const strainRatio = overloadDelta / (this.SNAP_LIMIT - this.OVERLOAD_THRESHOLD);

      if (Math.random() < strainRatio * GAMEPLAY_TUNING.PLAYER.STRAIN_RUMBLE_SCALE) {
        this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
          amplitude: 0.1 + strainRatio * GAMEPLAY_TUNING.PLAYER.STRAIN_RUMBLE_SCALE,
          duration: 0.08
        });
      }

      if (tether.tension >= this.SNAP_LIMIT) {
        this.snapTether(tether, health);
      }
    }
  }

  private snapTether(tether: TetherComponent, health: HealthComponent): void {
    tether.isAttached = false;
    tether.tension = 0.0;
    health.current = 0;
    this.context.broker.publish(GameEvent.PLAYER_DAMAGED, { amount: 5, source: "TETHER_SNAP" });
    this.context.broker.publish(GameEvent.PLAYER_HEALTH_CHANGED, { hp: 0, maxHp: health.max });
    this.context.broker.publish(GameEvent.PLAYER_DIED, undefined);
    this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
      amplitude: 1.5,
      duration: 0.7
    });
  }
}
