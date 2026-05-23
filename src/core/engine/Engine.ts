import { GameLoop } from "../loop/GameLoop";
import { EventBroker } from "../events/EventBroker";
import { SystemManager } from "../systems/SystemManager";

export class Engine {
    private loop: GameLoop;
    private broker: EventBroker;
    private systemManager: SystemManager;
    private canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement, broker: EventBroker, systemManager: SystemManager) {
        this.canvas = canvas;
        this.broker = broker;
        this.systemManager = systemManager;
        
        this.loop = new GameLoop(
            (dt) => this.update(dt),
            (alpha) => this.render(alpha)
        );
    }

    public start(): void {
        this.systemManager.initAll();
        this.loop.start();
    }

    public stop(): void {
        this.loop.stop();
        this.systemManager.disposeAll();
    }

    private update(dt: number): void {
        this.systemManager.updateAll(dt);
    }

    private render(alpha: number): void {
        this.systemManager.renderAll(alpha);
    }
}
