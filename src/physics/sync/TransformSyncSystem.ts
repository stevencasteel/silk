import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent, TetherComponent, TraversalStateComponent, SpiderAIComponent, HealthComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import * as BABYLON from "@babylonjs/core";

export class TransformSyncSystem implements ISystem {
    readonly phase = SystemPhase.RenderSync;

    private scratchPrevQuat = new BABYLON.Quaternion();
    private scratchCurrQuat = new BABYLON.Quaternion();
    private scrollOffset    = 0.0;
    private scrollSpeed     = 5.0;

    private currentEmissiveR = 0.05;
    private currentEmissiveG = 0.15;
    private currentEmissiveB = 0.05;

    constructor(
        private refs: EntityRefs,
        private transforms: ComponentStore<TransformComponent>,
        private tethers: ComponentStore<TetherComponent>,
        private traversal: ComponentStore<TraversalStateComponent>,
        private visualRegistry: IVisualRegistry,
        private spiderAIs: ComponentStore<SpiderAIComponent>,
        private healthStore: ComponentStore<HealthComponent>
    ) {}

    public update(_dt: number): void {
        void _dt;
    }

    public render(alpha: number): void {
        this.scrollTicks();
        this.syncTransforms(alpha);
    }

    private scrollTicks(): void {
        const scene = this.visualRegistry.getScene();
        if (!scene) return;

        const sAI = this.spiderAIs.get(this.refs.spider);
        const sHealth = this.healthStore.get(this.refs.spider);

        let targetScrollSpeed = 5.0;
        if (sHealth && sHealth.current <= 0) {
            targetScrollSpeed = 0.0;
        } else if (sAI) {
            if (sAI.state === "DASHING" || sAI.state === "RETURNING" || sAI.state === "DEFEATED") {
                targetScrollSpeed = 0.0;
            } else if (sHealth && sHealth.current < sHealth.max * 0.5) {
                targetScrollSpeed = 9.0;
            }
        }

        this.scrollSpeed = BABYLON.Scalar.Lerp(this.scrollSpeed, targetScrollSpeed, 0.1);

        const totalRange  = 36.0;
        this.scrollOffset += this.scrollSpeed * (1 / 60);
        if (this.scrollOffset > totalRange) {
            this.scrollOffset -= totalRange;
        }

        const ticks = scene.meshes.filter(m => m.metadata?.type === "scrolling_tick");
        for (const tick of ticks) {
            let y = tick.metadata.initialY - this.scrollOffset;
            while (y < -2.0) y += totalRange;
            tick.position.y = y;
        }
    }

    private syncTransforms(alpha: number): void {
        const tether = this.tethers.get(this.refs.player);
        const trav   = this.traversal.get(this.refs.player);

        for (const [id, curr] of this.transforms.entries()) {
            const node = this.visualRegistry.getTransformNode(id);
            if (!node) continue;

            node.position.x = curr.prevX + (curr.x - curr.prevX) * alpha;
            node.position.y = curr.prevY + (curr.y - curr.prevY) * alpha;
            node.position.z = curr.prevZ + (curr.z - curr.prevZ) * alpha;

            this.scratchPrevQuat.set(curr.prevQx, curr.prevQy, curr.prevQz, curr.prevQw);
            this.scratchCurrQuat.set(curr.qx, curr.qy, curr.qz, curr.qw);
            if (!node.rotationQuaternion) {
                node.rotationQuaternion = new BABYLON.Quaternion();
            }
            BABYLON.Quaternion.SlerpToRef(
                this.scratchPrevQuat,
                this.scratchCurrQuat,
                alpha,
                node.rotationQuaternion
            );

            if (id === this.refs.player && tether && trav) {
                const mesh = node as BABYLON.AbstractMesh;
                const mat  = mesh?.material as BABYLON.StandardMaterial | null;
                if (mat) {
                    this.updatePlayerEmissive(mat, tether.tension, trav.state, alpha);
                }
            }

            if (id === this.refs.spider) {
                const mesh = node as BABYLON.AbstractMesh;
                const mat  = mesh?.material as BABYLON.StandardMaterial | null;
                if (mat) {
                    const pulse = 0.02 + Math.sin(Date.now() * 0.003) * 0.015;
                    mat.emissiveColor.set(0.4 + pulse, 0.02, 0.02);
                }
            }
        }
    }

    private updatePlayerEmissive(
        mat: BABYLON.StandardMaterial,
        tension: number,
        state: string,
        _alpha: number
    ): void {
        void _alpha;

        let targetR: number;
        let targetG: number;
        let targetB: number;

        if (state === "WALL_SLIDING") {
            targetR = 0.05 + tension * 0.95;
            targetG = 0.15 + (1.0 - tension) * 0.40;
            targetB = 0.05 * (1.0 - tension);
        } else if (state === "LAUNCHING") {
            targetR = 0.9;
            targetG = 0.9;
            targetB = 0.9;
        } else {
            targetR = 0.05;
            targetG = 0.12;
            targetB = 0.05;
        }

        const lerpRate = 0.18;
        this.currentEmissiveR += (targetR - this.currentEmissiveR) * lerpRate;
        this.currentEmissiveG += (targetG - this.currentEmissiveG) * lerpRate;
        this.currentEmissiveB += (targetB - this.currentEmissiveB) * lerpRate;

        mat.emissiveColor.set(this.currentEmissiveR, this.currentEmissiveG, this.currentEmissiveB);
    }
}
