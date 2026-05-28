import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { ArenaGeometry } from "../mesh/ArenaGeometry";
import { POST_PROCESSING_PRESETS } from "../../core/engine/ArenaConfig";
import { VisualRegistry } from "./VisualRegistry";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import * as BABYLON from "@babylonjs/core";

export class RenderSystem implements ISystem {
  readonly phase = SystemPhase.PostRender;
  readonly initPhase = InitPhase.Bootstrap;
  private engine: BABYLON.Engine | null = null;
  private scene: BABYLON.Scene | null = null;
  private canvas: HTMLCanvasElement;
  private pipeline: BABYLON.DefaultRenderingPipeline | null = null;
  private unsubscribes: (() => void)[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    private visualRegistry: VisualRegistry,
    private broker: EventBroker
  ) {
    this.canvas = canvas;
  }

  public async init(): Promise<void> {
    this.engine = new BABYLON.Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true
    });
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.008, 0.008, 0.01, 1.0);

    const preset = POST_PROCESSING_PRESETS;

    const camera = new BABYLON.FreeCamera(
      "renderCamera",
      new BABYLON.Vector3(
        preset.CAMERA.DEFAULT_POS.x,
        preset.CAMERA.DEFAULT_POS.y,
        preset.CAMERA.DEFAULT_POS.z
      ),
      this.scene
    );
    camera.setTarget(
      new BABYLON.Vector3(
        preset.CAMERA.DEFAULT_TARGET.x,
        preset.CAMERA.DEFAULT_TARGET.y,
        preset.CAMERA.DEFAULT_TARGET.z
      )
    );
    camera.fovMode = BABYLON.Camera.FOVMODE_HORIZONTAL_FIXED;

    const envTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(
      "https://assets.babylonjs.com/environments/environmentSpecular.env",
      this.scene
    );
    this.scene.environmentTexture = envTexture;
    this.scene.environmentIntensity = 0.95;

    const ambientLight = new BABYLON.HemisphericLight(
      "ambientLight",
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );
    ambientLight.intensity = 0.18;

    const dirLight = new BABYLON.DirectionalLight(
      "dirLight",
      new BABYLON.Vector3(-0.35, -0.75, 0.55),
      this.scene
    );
    dirLight.intensity = 1.65;
    dirLight.specular = new BABYLON.Color3(0.6, 0.6, 0.65);

    const dirFillLight = new BABYLON.DirectionalLight(
      "dirFillLight",
      new BABYLON.Vector3(0.35, -0.75, 0.55),
      this.scene
    );
    dirFillLight.intensity = 1.35;
    dirFillLight.specular = new BABYLON.Color3(0.4, 0.4, 0.45);
    dirFillLight.setEnabled(true);

    const leftPointLight = new BABYLON.PointLight(
      "leftPointLight",
      new BABYLON.Vector3(-13.5, 14.0, -1.0),
      this.scene
    );
    leftPointLight.intensity = 1.35;
    leftPointLight.range = 35.0;
    leftPointLight.diffuse = new BABYLON.Color3(0.5, 0.6, 0.7);
    leftPointLight.specular = new BABYLON.Color3(0.2, 0.2, 0.25);
    leftPointLight.setEnabled(true);

    const rightPointLight = new BABYLON.PointLight(
      "rightPointLight",
      new BABYLON.Vector3(13.5, 14.0, -1.0),
      this.scene
    );
    rightPointLight.intensity = 1.35;
    rightPointLight.range = 35.0;
    rightPointLight.diffuse = new BABYLON.Color3(0.5, 0.6, 0.7);
    rightPointLight.specular = new BABYLON.Color3(0.2, 0.2, 0.25);
    rightPointLight.setEnabled(true);

    const pipeline = new BABYLON.DefaultRenderingPipeline("defaultPipeline", true, this.scene, [
      camera
    ]);
    pipeline.samples = preset.RENDERER.SAMPLES;
    pipeline.fxaaEnabled = true;
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = preset.RENDERER.BLOOM_THRESHOLD;
    pipeline.bloomWeight = preset.RENDERER.BLOOM_WEIGHT;
    pipeline.bloomKernel = preset.RENDERER.BLOOM_KERNEL;

    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.vignetteEnabled = true;
    pipeline.imageProcessing.vignetteWeight = preset.RENDERER.VIGNETTE_WEIGHT;
    pipeline.imageProcessing.vignetteColor = new BABYLON.Color4(0, 0, 0, 1);
    pipeline.imageProcessing.exposure = preset.RENDERER.EXPOSURE;
    pipeline.imageProcessing.contrast = preset.RENDERER.CONTRAST;

    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;

    pipeline.chromaticAberrationEnabled = true;
    pipeline.chromaticAberration.aberrationAmount = 0.0;
    pipeline.chromaticAberration.radialIntensity = 1.2;
    this.pipeline = pipeline;

    const shadowGen = new BABYLON.ShadowGenerator(preset.RENDERER.SHADOW_MAP_SIZE, dirLight);
    shadowGen.usePercentageCloserFiltering = true;
    shadowGen.filteringQuality = BABYLON.ShadowGenerator.QUALITY_MEDIUM;
    shadowGen.darkness = preset.RENDERER.SHADOW_DARKNESS;

    this.visualRegistry.setSceneAndShadows(this.scene, shadowGen);

    const arenaGeo = new ArenaGeometry(this.scene);
    arenaGeo.generateElevatorShaft();

    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.PLAYER_DAMAGED, () => {
        if (this.pipeline) {
          this.pipeline.chromaticAberration.aberrationAmount = 45.0;
        }
      })
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.WEAVER_DAMAGED, () => {
        if (this.pipeline) {
          this.pipeline.chromaticAberration.aberrationAmount = 25.0;
        }
      })
    );
    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.GAME_RESET, () => {
        if (this.pipeline) {
          this.pipeline.chromaticAberration.aberrationAmount = 0.0;
        }
      })
    );

    window.addEventListener("resize", this.handleResize);
  }

  public update(dt: number): void {
    if (this.pipeline && this.pipeline.chromaticAberration.aberrationAmount > 0.0) {
      this.pipeline.chromaticAberration.aberrationAmount -= dt * 110.0;
      if (this.pipeline.chromaticAberration.aberrationAmount < 0.0) {
        this.pipeline.chromaticAberration.aberrationAmount = 0.0;
      }
    }
  }

  public render(): void {
    if (this.scene) this.scene.render();
  }

  private handleResize = () => {
    if (this.engine) this.engine.resize();
  };

  public dispose(): void {
    window.removeEventListener("resize", this.handleResize);
    this.unsubscribes.forEach((unsub) => unsub());
    this.unsubscribes = [];
    this.visualRegistry.clear();
    if (this.scene) this.scene.dispose();
    if (this.engine) this.engine.dispose();
  }
}
