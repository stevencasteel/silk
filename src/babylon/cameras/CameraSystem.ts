import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { EventBroker } from "../../core/events/EventBroker";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent, WardenAIComponent } from "../../core/ecs/Components";
import * as BABYLON from "@babylonjs/core";

export class CameraSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private cameraNode: BABYLON.FreeCamera | null = null;

  constructor(
    _refs: EntityRefs,
    _transforms: ComponentStore<TransformComponent>,
    _wardenAIs: ComponentStore<WardenAIComponent>,
    private visualRegistry: IVisualRegistry,
    _broker: EventBroker
  ) {
    void _refs;
    void _transforms;
    void _wardenAIs;
    void _broker;
  }

  public init(): void {
    const scene = this.visualRegistry.getScene();
    if (scene && scene.activeCamera) {
      this.cameraNode = scene.activeCamera as BABYLON.FreeCamera;
      
      this.cameraNode.position.set(0, 14.0, -38.0);
      this.cameraNode.setTarget(new BABYLON.Vector3(0, 14.0, 0));
    }
  }

  public update(dt: number): void {
    void dt;
    if (this.cameraNode) {
      this.cameraNode.position.set(0, 14.0, -38.0);
      this.cameraNode.setTarget(new BABYLON.Vector3(0, 14.0, 0));
    }
  }

  public dispose(): void {}
}
