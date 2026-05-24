import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
  TetherComponent,
  KinematicTargetComponent,
  HealthComponent,
  TraversalStateComponent,
  TransformComponent
} from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { ARENA_CONFIG, CANONICAL_UNITS, GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";

export class EnvironmentCollisionSystem implements ISystem {
  readonly phase = SystemPhase.Collision;
  private readonly FLOOR_Y = ARENA_CONFIG.VERTICAL.FLOOR_Y;
  private readonly CEILING_Y = ARENA_CONFIG.VERTICAL.CEILING_Y;
  private readonly PLAYER_HALF_HEIGHT = ARENA_CONFIG.ENTITY.PLAYER_HALF_HEIGHT;
  
  private readonly OVERLOAD_THRESHOLD = CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT;
  private readonly SNAP_LIMIT = CANONICAL_UNITS.TETHER_STRAIN.SNAP_LIMIT;

  constructor(
    private refs: EntityRefs,
    private tethers: ComponentStore<TetherComponent>,
    private targets: ComponentStore<KinematicTargetComponent>,
    private healths: ComponentStore<HealthComponent>,
    private traversal: ComponentStore<TraversalStateComponent>,
    private broker: EventBroker,
    private transforms: ComponentStore<TransformComponent>
  ) {}

  public update(): void {
    const tether = this.tethers.get(this.refs.player);
    const target = this.targets.get(this.refs.player);
    const health = this.healths.get(this.refs.player);
    const trav = this.traversal.get(this.refs.player);
    if (!tether || !target || !health || !trav) return;
    this.clampToArenaBounds(target, tether);
    this.updateStrainMeter(tether, health, trav);
  }

  private clampToArenaBounds(target: KinematicTargetComponent, tether: TetherComponent): void {
    const minY = this.FLOOR_Y + this.PLAYER_HALF_HEIGHT;
    const maxY = this.CEILING_Y - this.PLAYER_HALF_HEIGHT;
    const tuning = GAMEPLAY_TUNING.PLAYER;

    if (target.y < minY) {
      if (tether.dynamicVelY < tuning.SQUASH_STRETCH.LAND_VEL_THRESHOLD) {
        this.broker.publish(GameEvent.PLAYER_LANDED, { x: target.x, y: minY });
        const pTrans = this.transforms.get(this.refs.player);
        if (pTrans) {
          pTrans.scaleY = tuning.SQUASH_STRETCH.SQUASH_LAND_Y;
          pTrans.scaleX = tuning.SQUASH_STRETCH.SQUASH_LAND_X;
          pTrans.scaleZ = tuning.SQUASH_STRETCH.SQUASH_LAND_Z;
        }
      }
      target.y = minY;
      tether.dynamicVelY = Math.max(0, tether.dynamicVelY);
    } else if (target.y > maxY) {
      target.y = maxY;
      tether.dynamicVelY = Math.min(0, tether.dynamicVelY);
    }
  }

  private updateStrainMeter(
    tether: TetherComponent,
    health: HealthComponent,
    trav: TraversalStateComponent
  ): void {
    const isOverloaded = trav.state === "WALL_SLIDING" && tether.tension >= this.OVERLOAD_THRESHOLD;

    if (isOverloaded) {
      const overloadDelta = tether.tension - this.OVERLOAD_THRESHOLD;
      const strainRatio = overloadDelta / (this.SNAP_LIMIT - this.OVERLOAD_THRESHOLD);

      if (Math.random() < strainRatio * GAMEPLAY_TUNING.PLAYER.STRAIN_RUMBLE_SCALE) {
        this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
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
    this.broker.publish(GameEvent.PLAYER_DAMAGED, { amount: 5, source: "TETHER_SNAP" });
    this.broker.publish(GameEvent.PLAYER_HEALTH_CHANGED, { hp: 0, maxHp: health.max });
    this.broker.publish(GameEvent.PLAYER_DIED, undefined);
    this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 1.5, duration: 0.7 });
  }
}
