import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent, HealthComponent, SilkComponent, WeaverAIComponent, KinematicVelocityComponent, InvulnerabilityComponent, KinematicTargetComponent, TraversalStateComponent } from "../../core/ecs/Components";
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
        private silks: ComponentStore<SilkComponent>,
        private weaverAIs: ComponentStore<WeaverAIComponent>,
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
        if (this.resetRequested) {
            this.resetGame();
            this.resetRequested = false;
        }
    }

    private resetGame(): void {
        this.gameState = "PLAYING";
        
        const pTrans = this.transforms.get(this.refs.player);
        const pHealth = this.healths.get(this.refs.player);
        const pSilk = this.silks.get(this.refs.player);
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
        if (pSilk) {
            pSilk.isAttached = true;
            pSilk.maxLength = 10.0;
            pSilk.currentLength = 10.0;
            pSilk.dynamicVelX = 0;
            pSilk.dynamicVelY = 0;
            pSilk.tension = 0.0;
            pSilk.anchorX = 0;
            pSilk.anchorY = 26;
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

        const wTrans = this.transforms.get(this.refs.weaver);
        const wHealth = this.healths.get(this.refs.weaver);
        const wAI = this.weaverAIs.get(this.refs.weaver);
        const wVel = this.velocities.get(this.refs.weaver);
        const wTarget = this.targets.get(this.refs.weaver);

        if (wTrans) {
            wTrans.x = 0; wTrans.y = 26; wTrans.z = 0;
            wTrans.prevX = 0; wTrans.prevY = 26; wTrans.prevZ = 0;
        }
        if (wTarget) {
            wTarget.x = 0; wTarget.y = 26; wTarget.z = 0; wTarget.active = true;
        }
        if (wHealth) {
            wHealth.current = wHealth.max;
        }
        if (wAI) {
            wAI.state = "SWEEPING";
            wAI.timeInState = 0;
            wAI.hue = "#ef4444";
        }
        if (wVel) {
            wVel.x = 4.0; wVel.y = 0; wVel.z = 0;
        }

        this.broker.publish(GameEvent.GAME_RESET, undefined);
        this.broker.publish(GameEvent.PLAYER_HEALTH_CHANGED, { hp: pHealth?.max || 5, maxHp: pHealth?.max || 5 });
        this.broker.publish(GameEvent.WEAVER_STATE_CHANGE, { state: "SWEEPING", hue: "#ef4444" });
        this.broker.publish(GameEvent.WEAVER_HEALTH_CHANGED, { hp: wHealth?.max || 100, maxHp: wHealth?.max || 100 });
    }

    public dispose(): void {
        window.removeEventListener("keydown", this.handleKeyDown);
    }
}
