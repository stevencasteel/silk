import * as BABYLON from "@babylonjs/core";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { EntityId } from "../../core/ecs/Entity";

export class VisualRegistry implements IVisualRegistry {
  private scene: BABYLON.Scene | null = null;
  private shadowGen: BABYLON.ShadowGenerator | null = null;
  private visualNodes = new Map<EntityId, BABYLON.TransformNode>();

  public setSceneAndShadows(scene: BABYLON.Scene, shadowGen: BABYLON.ShadowGenerator | null): void {
    this.scene = scene;
    this.shadowGen = shadowGen;
    if (shadowGen) {
      this.visualNodes.forEach((node) => {
        if (node instanceof BABYLON.AbstractMesh) {
          shadowGen.addShadowCaster(node);
          node.receiveShadows = true;
          node.getChildMeshes().forEach((m) => {
            if (!m.name.includes("weaver_eye") && !m.name.includes("foot_")) {
              shadowGen.addShadowCaster(m);
              m.receiveShadows = true;
            }
          });
        }
      });
    }
  }

  public getScene(): BABYLON.Scene | null {
    return this.scene;
  }

  public getTransformNode(id: EntityId): BABYLON.TransformNode | null {
    return this.visualNodes.get(id) || null;
  }

  public registerTransformNode(id: EntityId, node: BABYLON.TransformNode): void {
    this.visualNodes.set(id, node);
    if (this.shadowGen && node instanceof BABYLON.AbstractMesh) {
      this.shadowGen.addShadowCaster(node);
      node.receiveShadows = true;
    }
  }

  public unregisterTransformNode(id: EntityId): void {
    const node = this.visualNodes.get(id);
    if (node) {
      node.dispose();
      this.visualNodes.delete(id);
    }
  }

  public registerShadowCaster(mesh: BABYLON.AbstractMesh): void {
    if (this.shadowGen) {
      this.shadowGen.addShadowCaster(mesh);
      mesh.receiveShadows = true;
    }
  }

  public clear(): void {
    this.visualNodes.forEach((node) => node.dispose());
    this.visualNodes.clear();
  }
}
