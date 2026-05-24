import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
  SilkComponent,
  KinematicTargetComponent,
  HealthComponent,
  TraversalStateComponent
} from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";

export class EnvironmentCollisionSystem implements ISystem {
  readonly phase = SystemPhase.Collision;
  private readonly FLOOR_Y = -8.0;
  private readonly CEILING_Y = 38.0;
  private readonly PLAYER_HALF_HEIGHT = 0.9;
  
  // Cutoff limits corresponding to standard and danger zone tensions
  private readonly OVERLOAD_THRESHOLD = 1.0;
  private readonly SNAP_LIMIT = 1.3;

  constructor(
    private refs: EntityRefs,
    private silks: ComponentStore<SilkComponent>,
    private targets: ComponentStore<KinematicTargetComponent>,
    private healths: ComponentStore<HealthComponent>,
    private traversal: ComponentStore<TraversalStateComponent>,
    private broker: EventBroker
  ) {}

  public update(): void {
    const silk = this.silks.get(this.refs.player);
    const target = this.targets.get(this.refs.player);
    const health = this.healths.get(this.refs.player);
    const trav = this.traversal.get(this.refs.player);
    if (!silk || !target || !health || !trav) return;
    this.clampToArenaBounds(target, silk);
    this.updateStrainMeter(silk, health, trav);
  }

  private clampToArenaBounds(target: KinematicTargetComponent, silk: SilkComponent): void {
    const minY = this.FLOOR_Y + this.PLAYER_HALF_HEIGHT;
    const maxY = this.CEILING_Y - this.PLAYER_HALF_HEIGHT;
    if (target.y < minY) {
      target.y = minY;
      silk.dynamicVelY = Math.max(0, silk.dynamicVelY);
    } else if (target.y > maxY) {
      target.y = maxY;
      silk.dynamicVelY = Math.min(0, silk.dynamicVelY);
    }
  }

  private updateStrainMeter(
    silk: SilkComponent,
    health: HealthComponent,
    trav: TraversalStateComponent
  ): void {
    const isOverloaded = trav.state === "WALL_SLIDING" && silk.tension >= this.OVERLOAD_THRESHOLD;

    if (isOverloaded) {
      const overloadDelta = silk.tension - this.OVERLOAD_THRESHOLD;
      const strainRatio = overloadDelta / (this.SNAP_LIMIT - this.OVERLOAD_THRESHOLD); // 0.0 to 1.0

      if (Math.random() < strainRatio * 0.25) {
        this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
          amplitude: 0.1 + strainRatio * 0.25,
          duration: 0.08
        });
      }

      if (silk.tension >= this.SNAP_LIMIT) {
        this.snapSilk(silk, health);
      }
    }
  }

  private snapSilk(silk: SilkComponent, health: HealthComponent): void {
    silk.isAttached = false;
    silk.tension = 0.0;
    health.current = 0;
    this.broker.publish(GameEvent.PLAYER_DAMAGED, { amount: 5, source: "SILK_SNAP" });
    this.broker.publish(GameEvent.PLAYER_HEALTH_CHANGED, { hp: 0, maxHp: health.max });
    this.broker.publish(GameEvent.PLAYER_DIED, undefined);
    this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 1.5, duration: 0.7 });
  }
}
