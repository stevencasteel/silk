import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { GameEvent } from "../../core/events/GameEvents";
import { TetherComponent, HealthComponent, TetherStrainComponent } from "../../core/ecs/Components";
import { CANONICAL_UNITS } from "../../core/engine/ArenaConfig";

export class TetherStrainSystem implements ISystem {
  readonly phase = SystemPhase.Collision;

  private readonly OVERLOAD_THRESHOLD = CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT;
  private readonly SNAP_LIMIT = CANONICAL_UNITS.TETHER_STRAIN.SNAP_LIMIT;

  constructor(private context: SystemContext) {}

  public update(): void {
    const tether = this.context.stores.get<TetherComponent>("tether").get(this.context.refs.player);
    const health = this.context.stores.get<HealthComponent>("health").get(this.context.refs.player);
    const strainStore = this.context.stores.get<TetherStrainComponent>("tetherStrain");

    if (!tether || !health) return;

    const pId = this.context.refs.player;
    if (!strainStore.has(pId)) {
      strainStore.add(pId, {
        strain: 0,
        strainTimer: 0,
        isOverloaded: false,
        damageCount: 0,
        lastDamageTime: 0
      });
    }
    const tStrain = strainStore.get(pId)!;
    if (tStrain.damageCount === undefined) tStrain.damageCount = 0;
    if (tStrain.lastDamageTime === undefined) tStrain.lastDamageTime = 0;

    this.updateStrainMeter(tether, health, tStrain);
  }

  private updateStrainMeter(
    tether: TetherComponent,
    health: HealthComponent,
    tStrain: TetherStrainComponent
  ): void {
    const isOverloaded = tether.tension >= this.OVERLOAD_THRESHOLD;
    tStrain.isOverloaded = isOverloaded;
    tStrain.strain = tether.tension;

    if (isOverloaded) {
      // Unused overloadDelta removed for strict compilation
      // Unused strainRatio removed for strict compilation

      // Continuous shake is now handled directly by the CameraSystem via tension subscriptions.

      if (tether.tension >= this.SNAP_LIMIT) {
        const now = performance.now();
        if (now - tStrain.lastDamageTime! > 800) {
          tStrain.damageCount! += 1;
          tStrain.lastDamageTime = now;

          window.dispatchEvent(
            new CustomEvent("silk-tether-damaged", { detail: { count: tStrain.damageCount! } })
          );

          if (tStrain.damageCount! >= 3) {
            this.snapTether(tether, health);
          } else {
            this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
              amplitude: 0.95,
              duration: 0.45
            });
            tether.tension = 0.62;
          }
        }
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
