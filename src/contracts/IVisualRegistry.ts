import * as BABYLON from "@babylonjs/core";
import { EntityId } from "../core/ecs/Entity";

export interface IVisualQuery {
  getScene(): BABYLON.Scene | null;
  getTransformNode(id: EntityId): BABYLON.TransformNode | null;
}

export interface IVisualRegistration {
  registerTransformNode(id: EntityId, node: BABYLON.TransformNode): void;
  unregisterTransformNode(id: EntityId): void;
  registerShadowCaster(mesh: BABYLON.AbstractMesh): void;
}

export interface IVisualRegistry extends IVisualQuery, IVisualRegistration {}
