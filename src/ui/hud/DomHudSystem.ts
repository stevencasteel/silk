import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";

type HintLevel = "none" | "charging" | "ready" | "maxout";

export class DomHudSystem implements ISystem {
    readonly phase = SystemPhase.RenderSync;

    private unsubscribes: (() => void)[] = [];

    private tensionBar     : HTMLElement | null = null;
    private tensionText    : HTMLElement | null = null;
    private playerHpBar    : HTMLElement | null = null;
    private playerHpValue  : HTMLElement | null = null;
    private weaverHpBar    : HTMLElement | null = null;
    private weaverHpValue  : HTMLElement | null = null;
    private weaverStateText: HTMLElement | null = null;
    private traversalHint  : HTMLElement | null = null;
    private overlay        : HTMLElement | null = null;
    private overlayTitle   : HTMLElement | null = null;

    private lastHintLevel : HintLevel = "none";
    private currentState  : string = "AIRBORNE";

    constructor(private broker: EventBroker) {}

    public init(): void {
        this.cacheDomElements();
        this.registerSubscriptions();
    }

    private cacheDomElements(): void {
        if (typeof document === "undefined") return;
        this.tensionBar     = document.getElementById("tension-meter-bar");
        this.tensionText    = document.getElementById("tension-meter-text");
        this.playerHpBar    = document.getElementById("player-hp-bar");
        this.playerHpValue  = document.getElementById("player-hp-value");
        this.weaverHpBar    = document.getElementById("weaver-hp-bar");
        this.weaverHpValue  = document.getElementById("weaver-hp-value");
        this.weaverStateText = document.getElementById("weaver-state-text");
        this.traversalHint  = document.getElementById("traversal-hint");
        this.overlay        = document.getElementById("game-state-overlay");
        this.overlayTitle   = document.getElementById("game-state-title");
    }

    private registerSubscriptions(): void {
        this.unsubscribes.push(
            this.broker.subscribe(GameEvent.SILK_TENSION_CHANGE, ({ tension }) => {
                this.updateTensionBar(tension);
                this.updateHint(tension);
            })
        );
        this.unsubscribes.push(
            this.broker.subscribe(GameEvent.PLAYER_STATE_CHANGE, ({ state }) => {
                this.currentState = state;
                if (state !== "WALL_SLIDING") {
                    this.setHint("none");
                }
            })
        );
        this.unsubscribes.push(
            this.broker.subscribe(GameEvent.PLAYER_HEALTH_CHANGED, ({ hp, maxHp }) => {
                this.updatePlayerHp(hp, maxHp);
            })
        );
        this.unsubscribes.push(
            this.broker.subscribe(GameEvent.WEAVER_HEALTH_CHANGED, ({ hp, maxHp }) => {
                this.updateWeaverHp(hp, maxHp);
            })
        );
        this.unsubscribes.push(
            this.broker.subscribe(GameEvent.WEAVER_STATE_CHANGE, ({ state, hue }) => {
                this.updateWeaverStateLabel(state, hue);
            })
        );
        this.unsubscribes.push(
            this.broker.subscribe(GameEvent.GAME_OVER, () => {
                this.showOverlay("SILK SNAPPED", "#ef4444");
            })
        );
        this.unsubscribes.push(
            this.broker.subscribe(GameEvent.GAME_WIN, () => {
                this.showOverlay("WEAVER DEFEATED", "#10b981");
            })
        );
        this.unsubscribes.push(
            this.broker.subscribe(GameEvent.GAME_RESET, () => {
                this.hideOverlay();
                this.setHint("none");
            })
        );
    }

    private updateTensionBar(tension: number): void {
        const clamped = Math.max(0, Math.min(1, tension));
        const pct     = (clamped * 100).toFixed(1) + "%";

        if (this.tensionBar) {
            this.tensionBar.style.width = pct;
            if (clamped >= 0.98) {
                this.tensionBar.style.backgroundColor = "#ff4500";
                this.tensionBar.classList.add("tension-pulse");
            } else if (clamped >= 0.75) {
                this.tensionBar.style.backgroundColor = "#f59e0b";
                this.tensionBar.classList.remove("tension-pulse");
            } else if (clamped >= 0.40) {
                this.tensionBar.style.backgroundColor = "#eab308";
                this.tensionBar.classList.remove("tension-pulse");
            } else {
                this.tensionBar.style.backgroundColor = "#22c55e";
                this.tensionBar.classList.remove("tension-pulse");
            }
        }
        if (this.tensionText) {
            this.tensionText.textContent = (clamped * 100).toFixed(0) + "%";
            this.tensionText.style.color = clamped >= 0.9 ? "#fbbf24" : "#94a3b8";
        }
    }

    private updateHint(tension: number): void {
        if (this.currentState !== "WALL_SLIDING") return;

        if (tension >= 0.98) {
            this.setHint("maxout");
        } else if (tension >= 0.88) {
            this.setHint("ready");
        } else if (tension > 0.02) {
            this.setHint("charging");
        } else {
            this.setHint("none");
        }
    }

    private setHint(level: HintLevel): void {
        if (!this.traversalHint || level === this.lastHintLevel) return;
        this.lastHintLevel = level;

        switch (level) {
            case "none":
                this.traversalHint.style.opacity = "0";
                this.traversalHint.textContent   = "";
                break;
            case "charging":
                this.traversalHint.style.opacity = "1";
                this.traversalHint.style.color   = "#94a3b8";
                this.traversalHint.textContent   = "HOLD — CHARGING SILK";
                break;
            case "ready":
                this.traversalHint.style.opacity = "1";
                this.traversalHint.style.color   = "#fbbf24";
                this.traversalHint.textContent   = "RELEASE TO FLING";
                break;
            case "maxout":
                this.traversalHint.style.opacity = "1";
                this.traversalHint.style.color   = "#ff4500";
                this.traversalHint.textContent   = "MAX TENSION — FLING NOW";
                break;
        }
    }

    private updatePlayerHp(hp: number, maxHp: number): void {
        if (this.playerHpValue) {
            this.playerHpValue.textContent = `INTEGRITY: ${hp} / ${maxHp}`;
        }
        if (this.playerHpBar) {
            this.playerHpBar.style.width           = ((hp / maxHp) * 100).toFixed(0) + "%";
            this.playerHpBar.style.backgroundColor = hp <= 1 ? "#ef4444" : "#22c55e";
        }
    }

    private updateWeaverHp(hp: number, maxHp: number): void {
        if (this.weaverHpValue) {
            this.weaverHpValue.textContent = `${hp} / ${maxHp}`;
        }
        if (this.weaverHpBar) {
            const pct = Math.max(0, (hp / maxHp) * 100).toFixed(0) + "%";
            this.weaverHpBar.style.width = pct;
            this.weaverHpBar.style.backgroundColor = hp <= maxHp * 0.3 ? "#f97316" : "#ef4444";
        }
    }

    private updateWeaverStateLabel(state: string, hue: string): void {
        if (this.weaverStateText) {
            this.weaverStateText.textContent = state.toUpperCase();
            this.weaverStateText.style.color  = hue;
        }
    }

    private showOverlay(title: string, color: string): void {
        if (this.overlay) this.overlay.style.display = "flex";
        if (this.overlayTitle) {
            this.overlayTitle.textContent              = title;
            this.overlayTitle.style.color              = color;
            this.overlayTitle.style.textShadow         = `0 0 24px ${color}80`;
        }
    }

    private hideOverlay(): void {
        if (this.overlay) this.overlay.style.display = "none";
    }

    public dispose(): void {
        this.unsubscribes.forEach(u => u());
        this.unsubscribes = [];
    }
}
