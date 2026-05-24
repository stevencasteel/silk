import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { ArenaGeometry } from "../meshBuilders/ArenaGeometry";
import { POST_PROCESSING_PRESETS } from "../../core/engine/ArenaConfig";
import { VisualRegistry } from "./VisualRegistry";
import * as BABYLON from "@babylonjs/core";

export class RenderSystem implements ISystem {
  readonly phase = SystemPhase.PostRender;
  readonly initPhase = InitPhase.Bootstrap;
  private engine: BABYLON.Engine | null = null;
  private scene: BABYLON.Scene | null = null;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, private visualRegistry: VisualRegistry) {
    this.canvas = canvas;
  }

  public async init(): Promise<void> {
    this.engine = new BABYLON.Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true
    });
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.01, 0.01, 0.012, 1.0);

    const preset = POST_PROCESSING_PRESETS;

    const camera = new BABYLON.FreeCamera(
      "renderCamera",
      new BABYLON.Vector3(preset.CAMERA.DEFAULT_POS.x, preset.CAMERA.DEFAULT_POS.y, preset.CAMERA.DEFAULT_POS.z),
      this.scene
    );
    camera.setTarget(new BABYLON.Vector3(preset.CAMERA.DEFAULT_TARGET.x, preset.CAMERA.DEFAULT_TARGET.y, preset.CAMERA.DEFAULT_TARGET.z));
    camera.fovMode = BABYLON.Camera.FOVMODE_HORIZONTAL_FIXED;

    const ambientLight = new BABYLON.HemisphericLight(
      "ambientLight",
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );
    ambientLight.intensity = preset.RENDERER.AMBIENT_LIGHT_INTENSITY;

    const dirLight = new BABYLON.DirectionalLight(
      "dirLight",
      new BABYLON.Vector3(-0.3, -0.8, 0.5),
      this.scene
    );
    dirLight.intensity = preset.RENDERER.DIR_LIGHT_INTENSITY;
    dirLight.specular = new BABYLON.Color3(0.9, 0.9, 0.95);

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
    pipeline.chromaticAberrationEnabled = false;

    const shadowGen = new BABYLON.ShadowGenerator(1024, dirLight);
    shadowGen.useBlurExponentialShadowMap = true;
    shadowGen.blurKernel = 16;
    shadowGen.darkness = 0.6;

    this.visualRegistry.setSceneAndShadows(this.scene, shadowGen);

    const arenaGeo = new ArenaGeometry(this.scene);
    arenaGeo.generateElevatorShaft();

    window.addEventListener("resize", this.handleResize);
  }

  public update(): void {}

  public render(): void {
    if (this.scene) this.scene.render();
  }

  private handleResize = () => {
    if (this.engine) this.engine.resize();
  };

  public dispose(): void {
    window.removeEventListener("resize", this.handleResize);
    this.visualRegistry.clear();
    if (this.scene) this.scene.dispose();
    if (this.engine) this.engine.dispose();
  }
}
