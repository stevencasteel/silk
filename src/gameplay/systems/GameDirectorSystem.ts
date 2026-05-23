import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent, HealthComponent, TetherComponent, SpiderAIComponent, KinematicVelocityComponent, InvulnerabilityComponent, KinematicTargetComponent, TraversalStateComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";

export class GameDirectorSystem implements ISystem {
    readonly phase = SystemPhase.Gameplay;
    private gameState: "PLAYING" | "GAME_OVER" | "VICTORY" = "PLAYING";
    private resetRequested = false;

    constructor(
        private broker: EventBroker,
        private refs: EntityRefs,
        private transforms: ComponentStore<TransformComponent>,
        private healths: ComponentStore<HealthComponent>,
        private tethers: ComponentStore<TetherComponent>,
        private spiderAIs: ComponentStore<SpiderAIComponent>,
        private velocities: ComponentStore<KinematicVelocityComponent>,
        private iframes: ComponentStore<InvulnerabilityComponent>,
        private targets: ComponentStore<KinematicTargetComponent>,
        private traversal: ComponentStore<TraversalStateComponent>
    ) {}

    public init(): void {
        this.broker.subscribe(GameEvent.PLAYER_DIED, () => {
            if (this.gameState === "PLAYING") {
                this.gameState = "GAME_OVER";
                this.broker.publish(GameEvent.GAME_OVER, undefined);
            }
        });
        window.addEventListener("keydown", this.handleKeyDown);
    }

    private handleKeyDown = (e: KeyboardEvent): void => {
        if (e.key.toLowerCase() === "r" && this.gameState !== "PLAYING") {
            this.resetRequested = true;
        }
    };

    public update(_dt: number): void {
        void _dt;
        if (this.resetRequested) {
            this.resetGame();
            this.resetRequested = false;
        }
    }

    private resetGame(): void {
        this.gameState = "PLAYING";
        
        const pTrans = this.transforms.get(this.refs.player);
        const pHealth = this.healths.get(this.refs.player);
        const pTether = this.tethers.get(this.refs.player);
        const pVel = this.velocities.get(this.refs.player);
        const pIframe = this.iframes.get(this.refs.player);
        const pTarget = this.targets.get(this.refs.player);
        const pTrav = this.traversal.get(this.refs.player);

        if (pTrans) {
            pTrans.x = 0; pTrans.y = 16; pTrans.z = 0;
            pTrans.prevX = 0; pTrans.prevY = 16; pTrans.prevZ = 0;
        }
        if (pTarget) {
            pTarget.x = 0; pTarget.y = 16; pTarget.z = 0; pTarget.active = true;
        }
        if (pHealth) {
            pHealth.current = pHealth.max;
        }
        if (pTether) {
            pTether.isAttached = true;
            pTether.maxLength = 10.0;
            pTether.currentLength = 10.0;
            pTether.dynamicVelX = 0;
            pTether.dynamicVelY = 0;
            pTether.tension = 0.0;
            pTether.anchorX = 0;
            pTether.anchorY = 26;
        }
        if (pVel) {
            pVel.x = 0; pVel.y = 0; pVel.z = 0;
        }
        if (pIframe) {
            pIframe.timeRemaining = 0;
        }
        if (pTrav) {
            pTrav.state = "AIRBORNE";
            pTrav.wallNormalX = 0;
            pTrav.wallNormalY = 0;
            pTrav.wallDir = 0;
            pTrav.launchTimer = 0;
            pTrav.launchPower = 0;
        }

        const sTrans = this.transforms.get(this.refs.spider);
        const sHealth = this.healths.get(this.refs.spider);
        const sAI = this.spiderAIs.get(this.refs.spider);
        const sVel = this.velocities.get(this.refs.spider);
        const sTarget = this.targets.get(this.refs.spider);

        if (sTrans) {
            sTrans.x = 0; sTrans.y = 26; sTrans.z = 0;
            sTrans.prevX = 0; sTrans.prevY = 26; sTrans.prevZ = 0;
        }
        if (sTarget) {
            sTarget.x = 0; sTarget.y = 26; sTarget.z = 0; sTarget.active = true;
        }
        if (sHealth) {
            sHealth.current = sHealth.max;
        }
        if (sAI) {
            sAI.state = "SWEEPING";
            sAI.timeInState = 0;
            sAI.hue = "#ef4444";
            sAI.hasFakedDeath = false;
        }
        if (sVel) {
            sVel.x = 4.0; sVel.y = 0; sVel.z = 0;
        }

        this.broker.publish(GameEvent.GAME_RESET, undefined);
        this.broker.publish(GameEvent.PLAYER_HEALTH_CHANGED, { hp: pHealth?.max || 5, maxHp: pHealth?.max || 5 });
        this.broker.publish(GameEvent.SPIDER_STATE_CHANGE, { state: "SWEEPING", hue: "#ef4444" });
        this.broker.publish(GameEvent.SPIDER_HEALTH_CHANGED, { hp: sHealth?.max || 100, maxHp: sHealth?.max || 100 });
    }

    public dispose(): void {
        window.removeEventListener("keydown", this.handleKeyDown);
    }
}
