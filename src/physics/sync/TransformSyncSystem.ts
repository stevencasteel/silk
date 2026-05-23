import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent } from "../../core/ecs/Components";
import * as BABYLON from "@babylonjs/core";

export class TransformSyncSystem implements ISystem {
    readonly phase = SystemPhase.RenderSync;
    private scratchPrevQuat = new BABYLON.Quaternion();
    private scratchCurrQuat = new BABYLON.Quaternion();

    constructor(
        private transforms: ComponentStore<TransformComponent>, 
        private visualRegistry: IVisualRegistry
    ) {}

    public update(_dt: number): void {}

    public render(alpha: number): void {
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
        }
    }
}
