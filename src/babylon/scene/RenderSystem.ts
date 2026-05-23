import { ISystem } from "../../contracts/ISystem";

export class RenderSystem implements ISystem {
    private canvas: HTMLCanvasElement;
    
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    public init(): void {
        // Initialize Babylon Engine, Scene, Camera, Lights
    }

    public update(dt: number): void {
        // Logic updates for Babylon if needed
    }

    public render(alpha: number): void {
        // scene.render()
    }

    public dispose(): void {
        // scene.dispose()
    }
}
