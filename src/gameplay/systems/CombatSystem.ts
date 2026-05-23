import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
    TransformComponent,
    HealthComponent,
    SpiderAIComponent,
    TetherComponent,
    InvulnerabilityComponent,
    TraversalStateComponent
} from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { CommandBus } from "../../core/commands/CommandBus";
import { ApplyImpulseCommand } from "../../physics/commands/PhysicsCommands";

export class CombatSystem implements ISystem {
    readonly phase = SystemPhase.Gameplay;

    private readonly FLING_DAMAGE_THRESHOLD = 0.80;
    private readonly PLAYER_HIT_RADIUS      = 0.8;
    private readonly SPIDER_HIT_RADIUS      = 2.4;
    private readonly SPIDER_CONTACT_DAMAGE  = 1;
    private readonly PLAYER_IFRAME_DURATION = 1.2;
    private readonly PLAYER_FLING_DAMAGE    = 35;

    constructor(
        private refs: EntityRefs,
        private transforms: ComponentStore<TransformComponent>,
        private healths: ComponentStore<HealthComponent>,
        private spiderAIs: ComponentStore<SpiderAIComponent>,
        private tethers: ComponentStore<TetherComponent>,
        private iframes: ComponentStore<InvulnerabilityComponent>,
        private traversal: ComponentStore<TraversalStateComponent>,
        private broker: EventBroker,
        private commands: CommandBus
    ) {}

    public update(dt: number): void {
        const pTrans  = this.transforms.get(this.refs.player);
        const sTrans  = this.transforms.get(this.refs.spider);
        const pHealth = this.healths.get(this.refs.player);
        const sHealth = this.healths.get(this.refs.spider);
        const sAI     = this.spiderAIs.get(this.refs.spider);
        const pIframe = this.iframes.get(this.refs.player);
        const tether  = this.tethers.get(this.refs.player);
        const pTrav   = this.traversal.get(this.refs.player);

        if (!pTrans || !sTrans || !pHealth || !sHealth || !sAI || !pIframe || !tether || !pTrav) return;

        if (pIframe.timeRemaining > 0) {
            pIframe.timeRemaining -= dt;
        }

        const dx    = pTrans.x - sTrans.x;
        const dy    = pTrans.y - sTrans.y;
        const distSq = dx * dx + dy * dy;
        const hitDist = this.PLAYER_HIT_RADIUS + this.SPIDER_HIT_RADIUS;

        if (distSq >= hitDist * hitDist) return;

        if (pTrav.state === "LAUNCHING" && pTrav.launchPower >= this.FLING_DAMAGE_THRESHOLD) {
            this.resolvePlayerFlingHit(pTrans, sTrans, sHealth, sAI, tether, pTrav, dx, dy, distSq);
            return;
        }

        const spiderIsHostile = sAI.state === "DASHING";

        if (pIframe.timeRemaining <= 0 && spiderIsHostile) {
            this.resolveSpiderContactHit(pTrans, sTrans, pHealth, pIframe, dx, dy, distSq);
        }
    }

    private resolvePlayerFlingHit(
        _pTrans: TransformComponent,
        _sTrans: TransformComponent,
        sHealth: HealthComponent,
        sAI: SpiderAIComponent,
        tether: TetherComponent,
        pTrav: TraversalStateComponent,
        dx: number,
        dy: number,
        distSq: number
    ): void {
        void _pTrans; void _sTrans; void sAI;

        sHealth.current -= this.PLAYER_FLING_DAMAGE;
        
        this.broker.publish(GameEvent.SPIDER_DAMAGED, {
            amount: this.PLAYER_FLING_DAMAGE,
            source: "PLAYER_FLING"
        });
        
        this.broker.publish(GameEvent.SPIDER_HEALTH_CHANGED, {
            hp: Math.max(0, sHealth.current),
            maxHp: sHealth.max
        });
        
        this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 1.4, duration: 0.55 });

        const dist = Math.sqrt(distSq) || 1;
        tether.dynamicVelX =  (dx / dist) * 22;
        tether.dynamicVelY =  (dy / dist) * 22;
        pTrav.state        = "AIRBORNE";
        pTrav.launchPower  = 0;
        pTrav.launchTimer  = 0;
    }

    private resolveSpiderContactHit(
        pTrans: TransformComponent,
        sTrans: TransformComponent,
        pHealth: HealthComponent,
        pIframe: InvulnerabilityComponent,
        dx: number,
        dy: number,
        distSq: number
    ): void {
        void pTrans; void sTrans;

        pHealth.current -= this.SPIDER_CONTACT_DAMAGE;
        pIframe.timeRemaining = this.PLAYER_IFRAME_DURATION;

        const dist = Math.sqrt(distSq) || 1;
        this.commands.dispatch<ApplyImpulseCommand>({
            type: "APPLY_IMPULSE",
            entityId: this.refs.player,
            x: (dx / dist) * 16,
            y: (dy / dist) * 16 + 8,
            z: 0
        });

        this.broker.publish(GameEvent.PLAYER_DAMAGED, {
            amount: this.SPIDER_CONTACT_DAMAGE,
            source: "SPIDER"
        });
        this.broker.publish(GameEvent.PLAYER_HEALTH_CHANGED, {
            hp: pHealth.current,
            maxHp: pHealth.max
        });
        this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.5, duration: 0.3 });

        if (pHealth.current <= 0) {
            pHealth.current = 0;
            this.broker.publish(GameEvent.PLAYER_DIED, undefined);
        }
    }
}
