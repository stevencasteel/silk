import { ColorCache } from "../../core/utils/EngineUtils";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { GameEvent } from "../../core/events/GameEvents";
import { SystemContext } from "../../core/engine/SystemContext";
import * as BABYLON from "@babylonjs/core";

export class LightingSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  readonly initPhase = InitPhase.World;

  private unsub: (() => void) | null = null;
  private weaverLight: BABYLON.PointLight | null = null;
  private weaverKeyLight: BABYLON.SpotLight | null = null;
  private rimLight: BABYLON.DirectionalLight | null = null;
  private targetColor = new BABYLON.Color3(1.0, 1.0, 1.0);
  private currentColor = new BABYLON.Color3(1.0, 1.0, 1.0);

  private flashTimer = 0.0;
  private isFlashing = false;

  constructor(private context: SystemContext) {}

  public init(): void {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return;

    this.weaverLight = new BABYLON.PointLight(
      "weaverEmotionLight",
      new BABYLON.Vector3(0, 5, -5),
      scene
    );
    this.weaverLight.intensity = 2.0;
    this.weaverLight.range = 18.0;
    this.weaverLight.diffuse = this.currentColor;
    this.weaverLight.specular = new BABYLON.Color3(0.0, 0.0, 0.0); // Disable specular spot on colored light

    this.weaverKeyLight = new BABYLON.SpotLight(
      "weaverCarapaceKeyLight",
      new BABYLON.Vector3(0, 6, -11),
      new BABYLON.Vector3(0.08, -0.18, 1.0),
      Math.PI * 0.34,
      2.4,
      scene
    );
    this.weaverKeyLight.intensity = 3.0;
    this.weaverKeyLight.range = 28.0;
    this.weaverKeyLight.diffuse = new BABYLON.Color3(1.0, 1.0, 1.0);
    this.weaverKeyLight.specular = new BABYLON.Color3(0.0, 0.0, 0.0); // Disable specular spot on colored light

    this.rimLight = new BABYLON.DirectionalLight(
      "rimLight",
      new BABYLON.Vector3(-0.22, 0.28, -0.94),
      scene
    );
    this.rimLight.intensity = 1.8;
    this.rimLight.diffuse = new BABYLON.Color3(1.0, 1.0, 1.0);
    this.rimLight.specular = new BABYLON.Color3(0.0, 0.0, 0.0); // Disable specular spot on colored light

    this.unsub = this.context.broker.subscribe(GameEvent.WEAVER_STATE_CHANGE, (payload) => {
      this.setWeaverPhaseHue(payload.hue);
    });

    this.context.broker.subscribe(GameEvent.WEAVER_DIED, () => {
      this.triggerFlash();
    });

    this.context.broker.subscribe(GameEvent.PLAYER_DIED, () => {
      this.triggerFlash();
    });
  }

  public update(dt: number): void {
    if (!this.weaverLight) return;

    const weaverNode = this.context.visualQuery.getTransformNode(this.context.refs.weaver);
    if (weaverNode) {
      this.weaverLight.position.copyFrom(weaverNode.position);
      this.weaverLight.position.y = weaverNode.position.y + 1.4;
      this.weaverLight.position.z = weaverNode.position.z - 5.5;

      if (this.weaverKeyLight) {
        this.weaverKeyLight.position.set(
          weaverNode.position.x - 1.6,
          weaverNode.position.y + 2.6,
          weaverNode.position.z - 11.0
        );
        this.weaverKeyLight.direction.set(0.12, -0.18, 1.0);
      }
    }

    if (this.isFlashing) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.isFlashing = false;
      }
      BABYLON.Color3.LerpToRef(
        this.currentColor,
        this.targetColor,
        Math.min(1, dt * 5.0),
        this.currentColor
      );
    } else {
      BABYLON.Color3.LerpToRef(
        this.currentColor,
        this.targetColor,
        Math.min(1, dt * 4),
        this.currentColor
      );
    }

    this.weaverLight.diffuse.copyFrom(this.currentColor);
    if (this.weaverKeyLight) {
      this.weaverKeyLight.intensity = this.isFlashing ? 4.5 : 3.0;
    }
  }

  private triggerFlash(): void {
    this.isFlashing = true;
    this.flashTimer = 0.6;
    this.currentColor.set(3.0, 3.0, 3.0);
  }

  private setWeaverPhaseHue(colorHex: string): void {
    this.targetColor.copyFrom(ColorCache.getColor(colorHex));
  }

  public dispose(): void {
    if (this.unsub) this.unsub();
    if (this.weaverLight) this.weaverLight.dispose();
    if (this.weaverKeyLight) this.weaverKeyLight.dispose();
    if (this.rimLight) this.rimLight.dispose();
  }
}
