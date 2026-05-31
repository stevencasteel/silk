import { ISystem } from "../../contracts/ISystem";
import { SubscriptionTracker } from "../../core/utils/EngineUtils";
import { SystemPhase } from "../../contracts/SystemPhase";
import { GameEvent } from "../../core/events/GameEvents";
import { POST_PROCESSING_PRESETS, CAMERA_TUNING } from "../../core/engine/ArenaConfig";
import { SystemContext } from "../../core/engine/SystemContext";
import { TransformComponent, TraversalStateComponent, WeaverAIComponent } from "../../core/ecs/Components";
import { ParallaxScrollSystem } from "../systems/ParallaxScrollSystem";
import * as BABYLON from "@babylonjs/core";

export class CameraSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private cameraNode: BABYLON.FreeCamera | null = null;
  private shakeIntensity = 0.0;
  private shakeDuration = 0.0;
  private shakeTimer = 0.0;
  private shakeDirX = 0;
  private shakeDirY = 0;
  private noiseTime = 0.0;
  private _tracker = new SubscriptionTracker();
  private cameraTarget = new BABYLON.Vector3();

  private cameraScrollY = 0.0;

  private _shakeOffsetX = 0.0;
  private _shakeOffsetY = 0.0;
  private _shakeOffsetZ = 0.0;

  constructor(private context: SystemContext) {}

  public init(): void {
    const scene = this.context.visualQuery.getScene();
    if (scene && scene.activeCamera) {
      this.cameraNode = scene.activeCamera as BABYLON.FreeCamera;

      const preset = POST_PROCESSING_PRESETS.CAMERA;
      this.cameraNode.position.set(
        preset.DEFAULT_POS.x,
        preset.DEFAULT_POS.y,
        preset.DEFAULT_POS.z
      );
      this.cameraNode.setTarget(
        new BABYLON.Vector3(
          preset.DEFAULT_TARGET.x,
          preset.DEFAULT_TARGET.y,
          preset.DEFAULT_TARGET.z
        )
      );
    }

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.CAMERA_SHAKE_TRIGGERED, (payload) => {
        this.shakeIntensity = Math.max(this.shakeIntensity, payload.amplitude);
        this.shakeTimer = Math.max(this.shakeTimer, payload.duration);
        this.shakeDuration = this.shakeTimer;
        this.shakeDirX = payload.dirX ?? 0;
        this.shakeDirY = payload.dirY ?? 0;
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.cameraScrollY = 0.0;
      })
    );
  }

  private noise(t: number): number {
    return Math.sin(t * 17.1) * 0.43 + Math.sin(t * 31.7) * 0.27 + Math.sin(t * 7.3) * 0.3;
  }

  public update(dt: number): void {
    this.noiseTime += dt * 45.0;

    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;

      const decay = this.shakeDuration > 0 ? Math.pow(this.shakeTimer / this.shakeDuration, 2) : 0;
      const currentIntensity = this.shakeIntensity * decay;

      const noiseValX = this.noise(this.noiseTime) * currentIntensity;
      const noiseValY = this.noise(this.noiseTime + 100.0) * currentIntensity;
      const noiseValZ = this.noise(this.noiseTime + 200.0) * currentIntensity * 0.6;

      const len = Math.sqrt(this.shakeDirX * this.shakeDirX + this.shakeDirY * this.shakeDirY);
      if (len > 0) {
        const dx = this.shakeDirX / len;
        const dy = this.shakeDirY / len;

        const parallel = (noiseValX * dx + noiseValY * dy) * 0.85;
        const perpendicular = (-noiseValX * dy + noiseValY * dx) * 0.15;

        this._shakeOffsetX = parallel * dx - perpendicular * dy;
        this._shakeOffsetY = parallel * dy + perpendicular * dx;
        this._shakeOffsetZ = noiseValZ;
      } else {
        this._shakeOffsetX = noiseValX;
        this._shakeOffsetY = noiseValY;
        this._shakeOffsetZ = noiseValZ;
      }

      if (this.shakeTimer <= 0) {
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeDirX = 0;
        this.shakeDirY = 0;
        this._shakeOffsetX = 0;
        this._shakeOffsetY = 0;
        this._shakeOffsetZ = 0;
      }
    } else {
      this._shakeOffsetX = 0;
      this._shakeOffsetY = 0;
      this._shakeOffsetZ = 0;
    }

    const transforms = this.context.stores.get<TransformComponent>("transform");
    const playerTrans = transforms.get(this.context.refs.player);
    const weaverTrans = transforms.get(this.context.refs.weaver);
    const trav = this.context.stores
      .get<TraversalStateComponent>("traversal")
      .get(this.context.refs.player);
    const wAI = this.context.stores
      .get<WeaverAIComponent>("weaverAI")
      .get(this.context.refs.weaver);

    if (playerTrans && trav) {
      const baseY = POST_PROCESSING_PRESETS.CAMERA.DEFAULT_TARGET.y;
      const playerLocalY = playerTrans.y - baseY;

      const isBossEngaging = wAI && (wAI.state === "STRIKING" || wAI.state === "SHOCKWAVE" || wAI.state === "ASCENDING");
      const lowerLimit = CAMERA_TUNING.LOWER_COMFORT_Y;
      
      if (isBossEngaging && playerLocalY < lowerLimit) {
        const desiredScrollY = playerLocalY - lowerLimit;
        const maxScrollDelta = -Math.max(12.0, ParallaxScrollSystem.currentScrollSpeed) * dt;
        
        this.cameraScrollY = Math.max(
          CAMERA_TUNING.MIN_SCROLL_Y,
          Math.max(this.cameraScrollY + maxScrollDelta, desiredScrollY)
        );
      } else {
        let targetY = 0.0;
        if (weaverTrans) {
          const weaverLocalY = weaverTrans.y - baseY;
          if (weaverLocalY > 10.0) {
            targetY = Math.min(6.0, (weaverLocalY - 10.0) * 0.3);
          }
        }
        
        const panRecoveryFactor = 1.0 - Math.exp(-dt * 5.0);
        this.cameraScrollY = BABYLON.Scalar.Lerp(
          this.cameraScrollY,
          targetY,
          panRecoveryFactor
        );
      }
    }
  }

  public render(alpha: number): void {
    if (!this.cameraNode) return;

    const preset = POST_PROCESSING_PRESETS.CAMERA;
    const pNode = this.context.visualQuery.getTransformNode(this.context.refs.player);

    let targetScrollY = this.cameraScrollY;
    if (pNode) {
      const baseY = preset.DEFAULT_TARGET.y;
      const playerLocalY = pNode.position.y - baseY;
      const trav = this.context.stores
        .get<TraversalStateComponent>("traversal")
        .get(this.context.refs.player);
      const wAI = this.context.stores
        .get<WeaverAIComponent>("weaverAI")
        .get(this.context.refs.weaver);

      const isBossEngaging = wAI && (wAI.state === "STRIKING" || wAI.state === "SHOCKWAVE" || wAI.state === "ASCENDING");

      if (isBossEngaging && trav && playerLocalY < CAMERA_TUNING.LOWER_COMFORT_Y) {
        targetScrollY = this.cameraScrollY + (playerLocalY - CAMERA_TUNING.LOWER_COMFORT_Y) * alpha;
      }
    }

    this.cameraNode.position.set(
      preset.DEFAULT_POS.x + this._shakeOffsetX,
      preset.DEFAULT_POS.y + targetScrollY + this._shakeOffsetY,
      preset.DEFAULT_POS.z + this._shakeOffsetZ
    );
    this.cameraTarget.set(
      preset.DEFAULT_TARGET.x + this._shakeOffsetX * 0.25,
      preset.DEFAULT_TARGET.y + targetScrollY + this._shakeOffsetY * 0.25,
      preset.DEFAULT_TARGET.z
    );
    this.cameraNode.setTarget(this.cameraTarget);
  }

  public dispose(): void {
    this._tracker.clear();
  }
}
