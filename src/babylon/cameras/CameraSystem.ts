import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { EventBroker } from "../../core/events/EventBroker";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent, SpiderAIComponent } from "../../core/ecs/Components";
import { GameEvent } from "../../core/events/GameEvents";
import * as BABYLON from "@babylonjs/core";

export class CameraSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private cameraNode: BABYLON.FreeCamera | null = null;
  private shakeIntensity = 0.0;
  private shakeDuration = 0.0;
  private shakeTimer = 0.0;
  private unsub: (() => void) | null = null;

  constructor(
    private refs: EntityRefs,
    private transforms: ComponentStore<TransformComponent>,
    private spiderAIs: ComponentStore<SpiderAIComponent>,
    private visualRegistry: IVisualRegistry,
    private broker: EventBroker
  ) {
    void this.refs;
    void this.transforms;
    void this.spiderAIs;
  }

  public init(): void {
    const scene = this.visualRegistry.getScene();
    if (scene && scene.activeCamera) {
      this.cameraNode = scene.activeCamera as BABYLON.FreeCamera;
      
      this.cameraNode.position.set(0, 14.0, -38.0);
      this.cameraNode.setTarget(new BABYLON.Vector3(0, 14.0, 0));
    }

    this.unsub = this.broker.subscribe(GameEvent.CAMERA_SHAKE_TRIGGERED, (payload) => {
      this.shakeIntensity = Math.max(this.shakeIntensity, payload.amplitude);
      this.shakeTimer = Math.max(this.shakeTimer, payload.duration);
      this.shakeDuration = this.shakeTimer;
    });
  }

  public update(dt: number): void {
    let shakeOffsetX = 0;
    let shakeOffsetY = 0;
    let shakeOffsetZ = 0;

    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      
      const decay = this.shakeDuration > 0 ? (this.shakeTimer / this.shakeDuration) : 0;
      const currentIntensity = this.shakeIntensity * decay;

      shakeOffsetX = (Math.random() - 0.5) * currentIntensity * 2.0;
      shakeOffsetY = (Math.random() - 0.5) * currentIntensity * 2.0;
      shakeOffsetZ = (Math.random() - 0.5) * currentIntensity * 1.2;

      if (this.shakeTimer <= 0) {
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
      }
    }

    if (this.cameraNode) {
      this.cameraNode.position.set(shakeOffsetX, 14.0 + shakeOffsetY, -38.0 + shakeOffsetZ);
      this.cameraNode.setTarget(new BABYLON.Vector3(shakeOffsetX * 0.25, 14.0 + shakeOffsetY * 0.25, 0));
    }
  }

  public dispose(): void {
    if (this.unsub) {
      this.unsub();
    }
  }
}
