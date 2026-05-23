import { ISystem } from "../../contracts/ISystem";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent, TetherComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import * as BABYLON from "@babylonjs/core";

export class RopeVisualizerSystem implements ISystem {
    private ropeMesh: BABYLON.LinesMesh | null = null;
    private segments = 12;
    private points: BABYLON.Vector3[] = [];
    private scratchAnchor = new BABYLON.Vector3();
    private scratchPlayer = new BABYLON.Vector3();
    private scratchLerp = new BABYLON.Vector3();

    constructor(
        private refs: EntityRefs, 
        private transforms: ComponentStore<TransformComponent>, 
        private tethers: ComponentStore<TetherComponent>, 
        private visualRegistry: IVisualRegistry
    ) {
        for (let i = 0; i <= this.segments; i++) {
            this.points.push(new BABYLON.Vector3(0, 0, 0));
        }
    }

    public init(): void {
        const scene = this.visualRegistry.getScene();
        if (!scene) return;
        this.ropeMesh = BABYLON.MeshBuilder.CreateLines("tetherLine", { points: this.points, updatable: true }, scene);
        this.ropeMesh.color = new BABYLON.Color3(0.1, 0.6, 0.9);
    }

    public render(alpha: number): void {
        if (!this.ropeMesh) return;

        const pTrans = this.transforms.get(this.refs.player);
        const aTrans = this.transforms.get(this.refs.anchor);
        const tether = this.tethers.get(this.refs.player);
        if (!pTrans || !aTrans || !tether) return;

        const px = pTrans.prevX + (pTrans.x - pTrans.prevX) * alpha;
        const py = pTrans.prevY + (pTrans.y - pTrans.prevY) * alpha;
        
        this.scratchPlayer.set(px, py, 0);
        this.scratchAnchor.set(aTrans.x, aTrans.y, aTrans.z);

        const clampedTension = Math.max(0, Math.min(1, tether.currentLength / tether.maxLength));
        const sagFactor = (1.0 - clampedTension) * 1.5;
        const applySag = clampedTension < 0.95;

        for (let i = 0; i <= this.segments; i++) {
            const ratio = i / this.segments;
            
            BABYLON.Vector3.LerpToRef(this.scratchAnchor, this.scratchPlayer, ratio, this.scratchLerp);
            
            if (applySag) {
                this.scratchLerp.y -= Math.sin(ratio * Math.PI) * sagFactor;
            }
            
            const targetPoint = this.points[i];
            targetPoint.x = this.scratchLerp.x;
            targetPoint.y = this.scratchLerp.y;
            targetPoint.z = this.scratchLerp.z;
        }

        this.ropeMesh = BABYLON.MeshBuilder.CreateLines("tetherLine", { points: this.points, instance: this.ropeMesh });
    }

    public dispose(): void { 
        if (this.ropeMesh) this.ropeMesh.dispose(); 
    }
}
