import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TetherComponent, KinematicTargetComponent, HealthComponent, TraversalStateComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";

export class EnvironmentCollisionSystem implements ISystem {
    readonly phase = SystemPhase.Collision;
    
    private readonly MIN_Y = 1.0;
    private readonly MAX_Y = 27.5;
    private readonly STRAIN_THRESHOLD = 0.80;
    private readonly STRAIN_BREAK_TIME = 1.8;
    
    private currentStrain = 0.0;

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
        const target = this.targets.get(this.refs.player);
        const health = this.healths.get(this.refs.player);
        const trav = this.traversal.get(this.refs.player);

        if (!tether || !target || !health || !trav) return;

        const playerHalfHeight = 0.9;
        if (target.y - playerHalfHeight <= this.MIN_Y) {
            target.y = this.MIN_Y + playerHalfHeight;
            tether.dynamicVelY = Math.max(0, tether.dynamicVelY);
        } else if (target.y + playerHalfHeight >= this.MAX_Y) {
            target.y = this.MAX_Y - playerHalfHeight;
            tether.dynamicVelY = Math.min(0, tether.dynamicVelY);
        }

        if (tether.tension >= this.STRAIN_THRESHOLD && trav.state === "WALL_SLIDING") {
            this.currentStrain += dt;
            
            if (Math.random() < 0.15) {
                this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.15, duration: 0.1 });
            }

            if (this.currentStrain >= this.STRAIN_BREAK_TIME) {
                this.snapTether(tether, health);
            }
        } else {
            this.currentStrain = Math.max(0.0, this.currentStrain - dt * 2.0);
        }
    }

    private snapTether(tether: TetherComponent, health: HealthComponent): void {
        tether.isAttached = false;
        tether.tension = 0.0;
        this.currentStrain = 0.0;
        
        health.current = 0;
        
        this.broker.publish(GameEvent.PLAYER_DAMAGED, { amount: 5, source: "TETHER_SNAP" });
        this.broker.publish(GameEvent.PLAYER_HEALTH_CHANGED, { hp: 0, maxHp: health.max });
        this.broker.publish(GameEvent.PLAYER_DIED, undefined);
        this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 1.2, duration: 0.6 });
    }
}
