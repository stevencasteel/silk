import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent, WardenAIComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import * as BABYLON from "@babylonjs/core";

export class CameraSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private cameraNode: BABYLON.FreeCamera | null = null;
  private shakeIntensity = 0.0;
  private shakeTimeRemaining = 0.0;
  private unsub: (() => void) | null = null;
  private currentTarget = new BABYLON.Vector3(0, 10, -25);
  private springPosition = new BABYLON.Vector3(0, 10, -25);
  private springVelocity = new BABYLON.Vector3(0, 0, 0);
  private scratchLookAt = new BABYLON.Vector3();

  constructor(
    private refs: EntityRefs,
    private transforms: ComponentStore<TransformComponent>,
    private wardenAIs: ComponentStore<WardenAIComponent>,
    private visualRegistry: IVisualRegistry,
    private broker: EventBroker
  ) {}

  public init(): void {
    const scene = this.visualRegistry.getScene();
    if (scene && scene.activeCamera) {
      this.cameraNode = scene.activeCamera as BABYLON.FreeCamera;
      this.springPosition.copyFrom(this.cameraNode.position);
    }
    this.unsub = this.broker.subscribe(GameEvent.CAMERA_SHAKE_TRIGGERED, (payload) => {
      this.shakeIntensity = Math.max(this.shakeIntensity, payload.amplitude);
      this.shakeTimeRemaining = Math.max(this.shakeTimeRemaining, payload.duration);
    });
  }

  public update(dt: number): void {
    if (!this.cameraNode) {
      const scene = this.visualRegistry.getScene();
      if (scene && scene.activeCamera) {
        this.cameraNode = scene.activeCamera as BABYLON.FreeCamera;
        this.springPosition.copyFrom(this.cameraNode.position);
      }
      return;
    }

    const p = this.transforms.get(this.refs.player);
    const w = this.transforms.get(this.refs.warden);
    const wAI = this.wardenAIs.get(this.refs.warden);

    if (p) {
      let targetX = p.x;
      let targetY = p.y + 2.0;
      let camZ = -22.0;

      if (w && wAI) {
        const dx = w.x - p.x;
        const dy = w.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (wAI.state === "CHARGE_ATTACK" || wAI.state === "CHARGE_PREP" || dist < 8.0) {
          targetX = p.x * 0.75 + w.x * 0.25;
          targetY = (p.y * 0.75 + w.y * 0.25) + 2.0;
          camZ = -28.0; 
        }
      }
      
      this.currentTarget.set(targetX, targetY, camZ);
    }

    const stiffness = 8.0, damping = 3.5;
    const forceX = (this.currentTarget.x - this.springPosition.x) * stiffness - this.springVelocity.x * damping;
    const forceY = (this.currentTarget.y - this.springPosition.y) * stiffness - this.springVelocity.y * damping;
    const forceZ = (this.currentTarget.z - this.springPosition.z) * stiffness - this.springVelocity.z * damping;

    this.springVelocity.x += forceX * dt;
    this.springVelocity.y += forceY * dt;
    this.springVelocity.z += forceZ * dt;

    this.springPosition.x += this.springVelocity.x * dt;
    this.springPosition.y += this.springVelocity.y * dt;
    this.springPosition.z += this.springVelocity.z * dt;

    this.cameraNode.position.copyFrom(this.springPosition);

    if (this.shakeTimeRemaining > 0) {
      this.shakeTimeRemaining -= dt;
      const ci = this.shakeIntensity * (this.shakeTimeRemaining / 0.5);
      if (ci > 0) {
        this.cameraNode.position.x += (Math.random() - 0.5) * ci * 2.5;
        this.cameraNode.position.y += (Math.random() - 0.5) * ci * 2.5;
      }
    } else {
      this.shakeIntensity = 0;
    }

    this.scratchLookAt.set(this.currentTarget.x, this.currentTarget.y - 2.0, 0);
    this.cameraNode.setTarget(this.scratchLookAt);
  }

  public dispose(): void {
    if (this.unsub) this.unsub();
  }
}
