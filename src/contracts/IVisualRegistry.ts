import * as BABYLON from "@babylonjs/core";
import { EntityId } from "../core/ecs/Entity";
export interface IVisualRegistry {
    getScene(): BABYLON.Scene | null;
    getTransformNode(id: EntityId): BABYLON.TransformNode | null;
    registerTransformNode(id: EntityId, node: BABYLON.TransformNode): void;
    unregisterTransformNode(id: EntityId): void;
}
