import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent } from "../../core/ecs/Components";
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
        
        if (p) {
            let fx = p.x, fy = p.y;
            if (w) { 
                fx = p.x * 0.7 + w.x * 0.3; 
                fy = p.y * 0.7 + w.y * 0.3; 
            }
            this.currentTarget.set(fx, fy + 1.5, -24.0);
        }

        const stiffness = 8.0, damping = 3.5;
        const forceX = (this.currentTarget.x - this.springPosition.x) * stiffness - this.springVelocity.x * damping;
        const forceY = (this.currentTarget.y - this.springPosition.y) * stiffness - this.springVelocity.y * damping;
        
        this.springVelocity.x += forceX * dt; 
        this.springVelocity.y += forceY * dt;
        this.springPosition.x += this.springVelocity.x * dt; 
        this.springPosition.y += this.springVelocity.y * dt;
        
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

        this.scratchLookAt.set(this.currentTarget.x, this.currentTarget.y, 0);
        this.cameraNode.setTarget(this.scratchLookAt);
    }

    public dispose(): void { 
        if (this.unsub) this.unsub(); 
    }
}
