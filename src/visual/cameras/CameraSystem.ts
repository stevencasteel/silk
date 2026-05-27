import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { GameEvent } from "../../core/events/GameEvents";
import { POST_PROCESSING_PRESETS, CAMERA_TUNING } from "../../core/engine/ArenaConfig";
import { SystemContext } from "../../core/engine/SystemContext";
import { TransformComponent, TraversalStateComponent } from "../../core/ecs/Components";
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
  private unsub: (() => void)[] = [];
  private cameraTarget = new BABYLON.Vector3();

  private cameraScrollY = 0.0;

  constructor(private context: SystemContext) {}

  public init(): void {
    const scene = this.context.visualRegistry.getScene();
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

    this.unsub.push(
      this.context.broker.subscribe(GameEvent.CAMERA_SHAKE_TRIGGERED, (payload) => {
        this.shakeIntensity = Math.max(this.shakeIntensity, payload.amplitude);
        this.shakeTimer = Math.max(this.shakeTimer, payload.duration);
        this.shakeDuration = this.shakeTimer;
        this.shakeDirX = payload.dirX ?? 0;
        this.shakeDirY = payload.dirY ?? 0;
      })
    );

    this.unsub.push(
      this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.cameraScrollY = 0.0;
      })
    );
  }

  private noise(t: number): number {
    return Math.sin(t * 17.1) * 0.43 + Math.sin(t * 31.7) * 0.27 + Math.sin(t * 7.3) * 0.3;
  }

  public update(dt: number): void {
    let shakeOffsetX = 0;
    let shakeOffsetY = 0;
    let shakeOffsetZ = 0;

    this.noiseTime += dt * 45.0;

    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;

      const decay = this.shakeDuration > 0 ? this.shakeTimer / this.shakeDuration : 0;
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

        shakeOffsetX = parallel * dx - perpendicular * dy;
        shakeOffsetY = parallel * dy + perpendicular * dx;
        shakeOffsetZ = noiseValZ;
      } else {
        shakeOffsetX = noiseValX;
        shakeOffsetY = noiseValY;
        shakeOffsetZ = noiseValZ;
      }

      if (this.shakeTimer <= 0) {
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeDirX = 0;
        this.shakeDirY = 0;
      }
    }

    const transforms = this.context.stores.get<TransformComponent>("transform");
    const playerTrans = transforms.get(this.context.refs.player);
    const trav = this.context.stores.get<TraversalStateComponent>("traversal").get(this.context.refs.player);

    if (playerTrans && trav) {
      const baseY = POST_PROCESSING_PRESETS.CAMERA.DEFAULT_TARGET.y;
      const playerLocalY = playerTrans.y - (baseY + this.cameraScrollY);

      if (trav.state === "WALL_SLIDING") {
        if (playerLocalY < CAMERA_TUNING.LOWER_COMFORT_Y) {
          const targetScrollY = this.cameraScrollY + (playerLocalY - CAMERA_TUNING.LOWER_COMFORT_Y);
          const clampedScrollY = Math.max(CAMERA_TUNING.MIN_SCROLL_Y, Math.min(CAMERA_TUNING.MAX_SCROLL_Y, targetScrollY));
          this.cameraScrollY = BABYLON.Scalar.Lerp(this.cameraScrollY, clampedScrollY, CAMERA_TUNING.WALL_SLIDE_LERP);
        } else if (playerLocalY > -4.0 && this.cameraScrollY < 0.0) {
          this.cameraScrollY = BABYLON.Scalar.Lerp(this.cameraScrollY, 0.0, CAMERA_TUNING.NORMAL_LERP);
        }
      } else {
        this.cameraScrollY = BABYLON.Scalar.Lerp(this.cameraScrollY, 0.0, CAMERA_TUNING.NORMAL_LERP);
      }
    }

    const preset = POST_PROCESSING_PRESETS.CAMERA;

    if (this.cameraNode) {
      this.cameraNode.position.set(
        preset.DEFAULT_POS.x + shakeOffsetX,
        preset.DEFAULT_POS.y + this.cameraScrollY + shakeOffsetY,
        preset.DEFAULT_POS.z + shakeOffsetZ
      );
      this.cameraTarget.set(
        preset.DEFAULT_TARGET.x + shakeOffsetX * 0.25,
        preset.DEFAULT_TARGET.y + this.cameraScrollY + shakeOffsetY * 0.25,
        preset.DEFAULT_TARGET.z
      );
      this.cameraNode.setTarget(this.cameraTarget);
    }
  }

  public dispose(): void {
    this.unsub.forEach((unsub) => unsub());
    this.unsub = [];
  }
}
