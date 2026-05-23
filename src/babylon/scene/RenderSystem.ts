import { ISystem } from "../../contracts/ISystem";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { ArenaGeometry } from "../meshBuilders/ArenaGeometry";
import { EntityId } from "../../core/ecs/Entity";
import * as BABYLON from "@babylonjs/core";

export class RenderSystem implements ISystem, IVisualRegistry {
    private engine: BABYLON.Engine | null = null;
    private scene: BABYLON.Scene | null = null;
    private canvas: HTMLCanvasElement;
    private visualNodes = new Map<EntityId, BABYLON.TransformNode>();

    constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; }

    public async init(): Promise<void> {
        this.engine = new BABYLON.Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true });
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.clearColor = new BABYLON.Color4(0.01, 0.01, 0.02, 1.0);
        const camera = new BABYLON.FreeCamera("renderCamera", new BABYLON.Vector3(0, 10, -25), this.scene);
        camera.setTarget(BABYLON.Vector3.Zero());
        const light = new BABYLON.HemisphericLight("ambientLight", new BABYLON.Vector3(0, 1, 0), this.scene);
        light.intensity = 0.55;
        const arenaGeo = new ArenaGeometry(this.scene);
        arenaGeo.generateElevatorShaft();
        window.addEventListener("resize", this.handleResize);
    }

    public update(dt: number): void {}
    public render(alpha: number): void { if (this.scene) this.scene.render(); }
    public getScene(): BABYLON.Scene | null { return this.scene; }
    public getTransformNode(id: EntityId): BABYLON.TransformNode | null { return this.visualNodes.get(id) || null; }
    public registerTransformNode(id: EntityId, node: BABYLON.TransformNode): void { this.visualNodes.set(id, node); }
    public unregisterTransformNode(id: EntityId): void { const node = this.visualNodes.get(id); if (node) { node.dispose(); this.visualNodes.delete(id); } }
    private handleResize = () => { if (this.engine) this.engine.resize(); };
    public dispose(): void { window.removeEventListener("resize", this.handleResize); if (this.scene) this.scene.dispose(); if (this.engine) this.engine.dispose(); }
}
