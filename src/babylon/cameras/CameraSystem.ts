import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { EventBroker } from "../../core/events/EventBroker";
import * as BABYLON from "@babylonjs/core";

export class CameraSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private cameraNode: BABYLON.FreeCamera | null = null;

  constructor(
    _refs: any,
    _transforms: any,
    _wardenAIs: any,
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
      
      // Fixed static camera lock at depth of -38
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
