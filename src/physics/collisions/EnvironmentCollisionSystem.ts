import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
    TetherComponent,
    KinematicTargetComponent,
    HealthComponent,
    TraversalStateComponent
} from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";

// ---------------------------------------------------------------------------
// EnvironmentCollisionSystem
// Clamps player to arena bounds and manages the tether-snap death mechanic.
// Strain only accumulates when the silk is over-extended (tension >= threshold)
// while wall-sliding. The player has a generous 2.4 s window at max tension
// before the rope snaps.
// ---------------------------------------------------------------------------

export class EnvironmentCollisionSystem implements ISystem {
    readonly phase = SystemPhase.Collision;

    private readonly FLOOR_Y            = 1.0;
    private readonly CEILING_Y          = 27.4;
    private readonly PLAYER_HALF_HEIGHT = 0.9;

    // Snap tuning: strain timer only ticks when tension >= threshold
    private readonly SNAP_THRESHOLD     = 0.90;
    private readonly SNAP_BREAK_TIME    = 2.6;   // seconds at or above threshold before snap
    private readonly SNAP_DECAY_RATE    = 2.5;   // how fast strain drains when below threshold

    private strainAccum = 0.0;

    constructor(
        private refs: EntityRefs,
        private tethers: ComponentStore<TetherComponent>,
        private targets: ComponentStore<KinematicTargetComponent>,
        private healths: ComponentStore<HealthComponent>,
        private traversal: ComponentStore<TraversalStateComponent>,
        private broker: EventBroker
    ) {}

    public update(dt: number): void {
        const tether = this.tethers.get(this.refs.player);
        const target  = this.targets.get(this.refs.player);
        const health  = this.healths.get(this.refs.player);
        const trav    = this.traversal.get(this.refs.player);

        if (!tether || !target || !health || !trav) return;

        this.clampToArenaBounds(target, tether);
        this.updateStrainMeter(dt, tether, health, trav);
    }

    private clampToArenaBounds(
        target: KinematicTargetComponent,
        tether: TetherComponent
    ): void {
        const minY = this.FLOOR_Y + this.PLAYER_HALF_HEIGHT;
        const maxY = this.CEILING_Y - this.PLAYER_HALF_HEIGHT;

        if (target.y < minY) {
            target.y = minY;
            tether.dynamicVelY = Math.max(0, tether.dynamicVelY);
        } else if (target.y > maxY) {
            target.y = maxY;
            tether.dynamicVelY = Math.min(0, tether.dynamicVelY);
        }
    }

    private updateStrainMeter(
        dt: number,
        tether: TetherComponent,
        health: HealthComponent,
        trav: TraversalStateComponent
    ): void {
        const overloaded = tether.tension >= this.SNAP_THRESHOLD
            && trav.state === "WALL_SLIDING";

        if (overloaded) {
            this.strainAccum += dt;

            // Jitter feedback escalates as rope approaches breaking point
            const strainRatio = this.strainAccum / this.SNAP_BREAK_TIME;
            if (Math.random() < strainRatio * 0.25) {
                this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
                    amplitude: 0.1 + strainRatio * 0.25,
                    duration: 0.08
                });
            }

            if (this.strainAccum >= this.SNAP_BREAK_TIME) {
                this.snapTether(tether, health);
            }
        } else {
            this.strainAccum = Math.max(0, this.strainAccum - this.SNAP_DECAY_RATE * dt);
        }
    }

    private snapTether(tether: TetherComponent, health: HealthComponent): void {
        tether.isAttached = false;
        tether.tension    = 0.0;
        this.strainAccum  = 0.0;
        health.current    = 0;

        this.broker.publish(GameEvent.PLAYER_DAMAGED,        { amount: 5, source: "TETHER_SNAP" });
        this.broker.publish(GameEvent.PLAYER_HEALTH_CHANGED, { hp: 0, maxHp: health.max });
        this.broker.publish(GameEvent.PLAYER_DIED,           undefined);
        this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 1.5, duration: 0.7 });
    }

    public resetStrain(): void {
        this.strainAccum = 0.0;
    }
}
