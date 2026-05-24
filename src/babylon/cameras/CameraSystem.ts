import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { POST_PROCESSING_PRESETS } from "../../core/engine/ArenaConfig";
import * as BABYLON from "@babylonjs/core";

export class CameraSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private cameraNode: BABYLON.FreeCamera | null = null;
  private shakeIntensity = 0.0;
  private shakeDuration = 0.0;
  private shakeTimer = 0.0;
  private unsub: (() => void) | null = null;
  private cameraTarget = new BABYLON.Vector3();

  constructor(
    private visualRegistry: IVisualRegistry,
    private broker: EventBroker
  ) {}

  public init(): void {
    const scene = this.visualRegistry.getScene();
    if (scene && scene.activeCamera) {
      this.cameraNode = scene.activeCamera as BABYLON.FreeCamera;

      const preset = POST_PROCESSING_PRESETS.CAMERA;
      this.cameraNode.position.set(preset.DEFAULT_POS.x, preset.DEFAULT_POS.y, preset.DEFAULT_POS.z);
      this.cameraNode.setTarget(new BABYLON.Vector3(preset.DEFAULT_TARGET.x, preset.DEFAULT_TARGET.y, preset.DEFAULT_TARGET.z));
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

      const decay = this.shakeDuration > 0 ? this.shakeTimer / this.shakeDuration : 0;
      const currentIntensity = this.shakeIntensity * decay;

      shakeOffsetX = (Math.random() - 0.5) * currentIntensity * 2.0;
      shakeOffsetY = (Math.random() - 0.5) * currentIntensity * 2.0;
      shakeOffsetZ = (Math.random() - 0.5) * currentIntensity * 1.2;

      if (this.shakeTimer <= 0) {
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
      }
    }

    const preset = POST_PROCESSING_PRESETS.CAMERA;

    if (this.cameraNode) {
      this.cameraNode.position.set(
        preset.DEFAULT_POS.x + shakeOffsetX, 
        preset.DEFAULT_POS.y + shakeOffsetY, 
        preset.DEFAULT_POS.z + shakeOffsetZ
      );
      this.cameraTarget.set(
        preset.DEFAULT_TARGET.x + shakeOffsetX * 0.25, 
        preset.DEFAULT_TARGET.y + shakeOffsetY * 0.25, 
        preset.DEFAULT_TARGET.z
      );
      this.cameraNode.setTarget(this.cameraTarget);
    }
  }

  public dispose(): void {
    if (this.unsub) {
      this.unsub();
    }
  }
}
