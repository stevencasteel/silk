import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { GameEvent } from "../../core/events/GameEvents";
import {
  TetherComponent,
  HealthComponent,
  TetherStrainComponent,
  TraversalStateComponent,
  TransformComponent,
  ActorCosmeticComponent,
  KinematicTargetComponent,
  KinematicVelocityComponent
} from "../../core/ecs/Components";
import { CANONICAL_UNITS, GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";

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
        if (now - tStrain.lastDamageTime! > CANONICAL_UNITS.TETHER_STRAIN.DAMAGE_COOLDOWN_MS) {
          tStrain.damageCount! += 1;
          tStrain.lastDamageTime = now;

          window.dispatchEvent(
            new CustomEvent("silk-tether-damaged", { detail: { count: tStrain.damageCount! } })
          );

          if (tStrain.damageCount! >= 3) {
            this.snapTether(tether, health);
          } else {
            this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
              amplitude: 1.6,
              duration: 0.65
            });
            tether.tension = CANONICAL_UNITS.TETHER_STRAIN.TENSION_RESET_AFTER_DAMAGE;

            // PAUSE ELEVATOR SHAFT SCROLLING, WEAVER MOTION AND TRIGGER TUG SEQUENCE
            this.context.runtime.tetherDamagePauseTimer = 0.8;

            // 1. Force the player off the wall immediately (No Fling)
            const pId = this.context.refs.player;
            const pTrav = this.context.stores.get<TraversalStateComponent>("traversal").get(pId);
            if (pTrav) {
              pTrav.state = "AIRBORNE";
              pTrav.wallDir = 0;
              pTrav.wallNormalX = 0;
              pTrav.wallNormalY = 0;
              pTrav.stickyEntityId = -1;
            }

            // 2. Reduce current maximum allowed line length by exactly 50%
            const targetLength = Math.max(GAMEPLAY_TUNING.REEL.MIN_LENGTH, tether.maxLength * 0.5);
            tether.maxLength = targetLength;
            tether.desiredLength = targetLength;
            tether.currentLength = targetLength;

            const pTarget = this.context.stores.get<KinematicTargetComponent>("target").get(pId);
            if (pTarget) {
              const dx = pTarget.x - tether.anchorX;
              const dy = pTarget.y - tether.anchorY;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
              pTarget.x = tether.anchorX + (dx / dist) * targetLength;
              pTarget.y = tether.anchorY + (dy / dist) * targetLength;

              const pTrans = this.context.stores.get<TransformComponent>("transform").get(pId);
              if (pTrans) {
                pTrans.x = pTarget.x;
                pTrans.y = pTarget.y;
              }
            }

            const pVel = this.context.stores.get<KinematicVelocityComponent>("velocity").get(pId);
            if (pVel) {
              pVel.x = 0;
              pVel.y = 0;
            }

            // 3. Elastic tug squash animation on the Weaver
            const wId = this.context.refs.weaver;
            const wTrans = this.context.stores.get<TransformComponent>("transform").get(wId);
            const wCosmetic = this.context.stores.get<ActorCosmeticComponent>("cosmetic").get(wId);
            if (wTrans && wCosmetic) {
              wTrans.scaleVelY = -22.0;
              wTrans.scaleVelX = 14.0;
              wTrans.scaleVelZ = 14.0;
              wCosmetic.emissiveHue = "#ef4444";
            }
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
