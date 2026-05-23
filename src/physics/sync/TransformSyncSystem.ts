import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent, TetherComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import * as BABYLON from "@babylonjs/core";

export class TransformSyncSystem implements ISystem {
    readonly phase = SystemPhase.RenderSync;
    private scratchPrevQuat = new BABYLON.Quaternion();
    private scratchCurrQuat = new BABYLON.Quaternion();
    private scrollOffset = 0.0;

    constructor(
        private refs: EntityRefs,
        private transforms: ComponentStore<TransformComponent>, 
        private tethers: ComponentStore<TetherComponent>,
        private visualRegistry: IVisualRegistry
    ) {}

    public update(_dt: number): void {
        void _dt;
    }

    public render(alpha: number): void {
        // 1. Animate/Scroll the physical unit ticks downward to create the endless ascension illusion
        const scene = this.visualRegistry.getScene();
        if (scene) {
            const scrollSpeed = 5.0; // Speed matching downward wall displacement
            const totalRange = 36.0; // Range matching tick spawning heights
            this.scrollOffset += scrollSpeed * (1 / 60); // 60Hz estimate sync
            
            if (this.scrollOffset > totalRange) {
                this.scrollOffset -= totalRange;
            }

            const ticks = scene.meshes.filter(m => m.metadata && m.metadata.type === "scrolling_tick");
            for (const tick of ticks) {
                let currentY = tick.metadata.initialY - this.scrollOffset;
                while (currentY < -2.0) {
                    currentY += totalRange;
                }
                tick.position.y = currentY;
            }
        }

        // 2. Synchronize visual mesh positioning with simulation components
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
            
            BABYLON.Quaternion.SlerpToRef(this.scratchPrevQuat, this.scratchCurrQuat, alpha, node.rotationQuaternion);

            if (id === this.refs.player) {
                const tether = this.tethers.get(id);
                if (tether) {
                    const mesh = node as BABYLON.AbstractMesh;
                    if (mesh && mesh.material) {
                        const mat = mesh.material as BABYLON.StandardMaterial;
                        if (mat) {
                            const stress = Math.max(0.0, Math.min(1.0, (tether.currentLength / tether.maxLength) - 0.9) * 10.0);
                            mat.emissiveColor.r = 0.05 + stress * 0.95;
                            mat.emissiveColor.g = 0.15 * (1.0 - stress);
                            mat.emissiveColor.b = 0.05 * (1.0 - stress);
                        }
                    }
                }
            }
        }
    }
}
