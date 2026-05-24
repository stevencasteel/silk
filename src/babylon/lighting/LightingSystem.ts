import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import * as BABYLON from "@babylonjs/core";

export class LightingSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  readonly initPhase = InitPhase.World;

  private unsub: (() => void) | null = null;
  private weaverLight: BABYLON.PointLight | null = null;
  private targetColor = new BABYLON.Color3(0.3, 0.3, 0.4);
  private currentColor = new BABYLON.Color3(0.3, 0.3, 0.4);

  constructor(
    private broker: EventBroker,
    private visualRegistry: IVisualRegistry
  ) {}

  public init(): void {
    const scene = this.visualRegistry.getScene();
    if (!scene) return;

    this.weaverLight = new BABYLON.PointLight(
      "weaverEmotionLight",
      new BABYLON.Vector3(0, 5, -2),
      scene
    );
    this.weaverLight.intensity = 1.5;
    this.weaverLight.diffuse = this.currentColor;
    this.weaverLight.specular = this.currentColor;

    this.unsub = this.broker.subscribe(GameEvent.WEAVER_STATE_CHANGE, (payload) => {
      this.setWeaverPhaseHue(payload.hue);
    });
  }

  public update(dt: number): void {
    if (!this.weaverLight) return;

    BABYLON.Color3.LerpToRef(
      this.currentColor,
      this.targetColor,
      Math.min(1, dt * 4),
      this.currentColor
    );
    this.weaverLight.diffuse.copyFrom(this.currentColor);
    this.weaverLight.specular.copyFrom(this.currentColor);
  }

  private setWeaverPhaseHue(colorHex: string): void {
    const hex = colorHex.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    this.targetColor.set(r, g, b);
  }

  public dispose(): void {
    if (this.unsub) this.unsub();
    if (this.weaverLight) this.weaverLight.dispose();
  }
}
