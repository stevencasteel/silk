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

    if (isOverloaded && tether.tension >= this.SNAP_LIMIT) {
      const now = performance.now();
      const lastHit = tStrain.lastDamageTime ?? 0;

      if (now - lastHit > CANONICAL_UNITS.TETHER_STRAIN.DAMAGE_COOLDOWN_MS) {
        tStrain.damageCount = (tStrain.damageCount ?? 0) + 1;
        tStrain.lastDamageTime = now;

        window.dispatchEvent(
          new CustomEvent("silk-tether-damaged", { detail: { count: tStrain.damageCount } })
        );

        if (tStrain.damageCount >= 3) {
          this.snapTether(tether, health);
        } else {
          // REFINED FATIGUE PHYSICS: Violent Snap-Back
          this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
            amplitude: 2.2, // Increased intensity for snap
            duration: 0.75
          });

          // Reset tension to safe baseline to prevent immediate repeat damage
          tether.tension = CANONICAL_UNITS.TETHER_STRAIN.TENSION_RESET_AFTER_DAMAGE;
          this.context.runtime.tetherDamagePauseTimer = 0.8;

          const pId = this.context.refs.player;
          const pTrav = this.context.stores.get<TraversalStateComponent>("traversal").get(pId);
          const pVel = this.context.stores.get<KinematicVelocityComponent>("velocity").get(pId);
          const pTarget = this.context.stores.get<KinematicTargetComponent>("target").get(pId);

          // 1. Force the player off the wall immediately
          if (pTrav) {
            pTrav.state = "AIRBORNE";
            pTrav.wallDir = 0;
            pTrav.stickyEntityId = -1;
            pTrav.recoilTimer = 0.5; // Add recoil stun
          }

          // 2. Halve the allowed thread capacity
          const targetLength = Math.max(GAMEPLAY_TUNING.REEL.MIN_LENGTH, tether.maxLength * 0.5);
          tether.maxLength = targetLength;
          tether.desiredLength = targetLength;

          // 3. APPLY KINETIC SNAP: Pull player violently toward anchor
          if (pTarget && pVel) {
            const dx = tether.anchorX - pTarget.x;
            const dy = tether.anchorY - pTarget.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
            
            // Whip the player toward the anchor at high velocity
            const snapForce = 55.0; 
            pVel.x = (dx / dist) * snapForce;
            pVel.y = (dy / dist) * snapForce;
          }

          // 4. Elastic tug animation on Weaver
          const wId = this.context.refs.weaver;
          const wTrans = this.context.stores.get<TransformComponent>("transform").get(wId);
          const wCosmetic = this.context.stores.get<ActorCosmeticComponent>("cosmetic").get(wId);
          if (wTrans && wCosmetic) {
            wTrans.scaleVelY = -28.0; // Harder squash
            wTrans.scaleVelX = 18.0;
            wCosmetic.emissiveHue = "#ef4444";
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
      amplitude: 2.5,
      duration: 1.0
    });
  }
}
