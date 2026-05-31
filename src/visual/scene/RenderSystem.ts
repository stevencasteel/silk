import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { ArenaGeometry } from "../mesh/ArenaGeometry";
import { POST_PROCESSING_PRESETS } from "../../core/engine/ArenaConfig";
import { VisualRegistry } from "./VisualRegistry";
import { IEventBroker } from "../../contracts/ICore";
import { GameEvent } from "../../core/events/GameEvents";
import { SubscriptionTracker } from "../../core/utils/EngineUtils";
import { ProceduralTextureGenerator } from "./ProceduralTextureGenerator";
import * as BABYLON from "@babylonjs/core";

export class RenderSystem implements ISystem {
  readonly phase = SystemPhase.PostRender;
  readonly initPhase = InitPhase.UI; // Deferred compile pass after all assets are fully spawned
  private engine: BABYLON.Engine | null = null;
  private scene: BABYLON.Scene | null = null;
  private canvas: HTMLCanvasElement;
  private pipeline: BABYLON.DefaultRenderingPipeline | null = null;
  private _tracker = new SubscriptionTracker();

  constructor(
    canvas: HTMLCanvasElement,
    private visualRegistry: VisualRegistry,
    private broker: IEventBroker
  ) {
    this.canvas = canvas;
    this.engine = new BABYLON.Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true
    });
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.015, 0.005, 0.025, 1.0);

    // Bind early so getScene() is alive right from InitPhase.Bootstrap
    this.visualRegistry.setSceneAndShadows(this.scene, null);
  }

  public async init(): Promise<void> {
    this.broker.publish(GameEvent.GAME_BOOT_PROGRESS, {
      status: "Loading environment textures and lights..."
    });

    const preset = POST_PROCESSING_PRESETS;

    const camera = new BABYLON.FreeCamera(
      "renderCamera",
      new BABYLON.Vector3(
        preset.CAMERA.DEFAULT_POS.x,
        preset.CAMERA.DEFAULT_POS.y,
        preset.CAMERA.DEFAULT_POS.z
      ),
      this.scene!
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
      this.scene!
    );
    this.scene!.environmentTexture = envTexture;
    this.scene!.environmentIntensity = 1.45;

    const ambientLight = new BABYLON.HemisphericLight(
      "ambientLight",
      new BABYLON.Vector3(0, 1, 0),
      this.scene!
    );
    ambientLight.intensity = 0.08;

    const dirLight = new BABYLON.DirectionalLight(
      "dirLight",
      new BABYLON.Vector3(-0.35, -0.75, 0.55),
      this.scene!
    );
    dirLight.intensity = 1.65;
    dirLight.diffuse = new BABYLON.Color3(1.0, 1.0, 1.0);

    const dirFillLight = new BABYLON.DirectionalLight(
      "dirFillLight",
      new BABYLON.Vector3(0.35, -0.75, 0.55),
      this.scene!
    );
    dirFillLight.intensity = 1.35;
    dirFillLight.diffuse = new BABYLON.Color3(1.0, 1.0, 1.0);
    dirFillLight.setEnabled(true);

    const pointLightsConfigs = [
      {
        name: "leftPointLight",
        pos: new BABYLON.Vector3(-13.5, 14.0, -1.0),
        intensity: 1.45,
        range: 34.0,
        diffuse: new BABYLON.Color3(0.87, 0.99, 0.0)
      },
      {
        name: "rightPointLight",
        pos: new BABYLON.Vector3(13.5, 14.0, -1.0),
        intensity: 1.45,
        range: 34.0,
        diffuse: new BABYLON.Color3(1.0, 1.0, 1.0)
      }
    ];

    pointLightsConfigs.forEach((cfg) => {
      const pl = new BABYLON.PointLight(cfg.name, cfg.pos, this.scene!);
      pl.intensity = cfg.intensity;
      pl.range = cfg.range;
      pl.diffuse = cfg.diffuse;
      pl.setEnabled(true);
    });

    const lowerBackLight = new BABYLON.SpotLight(
      "shaftLowerBackUplight",
      new BABYLON.Vector3(0.0, -8.5, -7.5),
      new BABYLON.Vector3(0.0, 1.0, 0.55),
      Math.PI * 0.42,
      2.8,
      this.scene!
    );
    lowerBackLight.intensity = 3.8;
    lowerBackLight.range = 58.0;
    lowerBackLight.diffuse = new BABYLON.Color3(0.1, 0.0, 0.25);

    const uplightConfigs = [
      { name: "leftShaftUplight", pos: new BABYLON.Vector3(-10.5, -9.0, -4.2) },
      { name: "rightShaftUplight", pos: new BABYLON.Vector3(10.5, -9.0, -4.2) }
    ];

    uplightConfigs.forEach((cfg) => {
      const uplight = new BABYLON.PointLight(cfg.name, cfg.pos, this.scene!);
      uplight.intensity = 1.95;
      uplight.range = 32.0;
      uplight.diffuse = new BABYLON.Color3(1.0, 1.0, 1.0);
    });

    const pipeline = new BABYLON.DefaultRenderingPipeline("defaultPipeline", true, this.scene!, [
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
    pipeline.imageProcessing.vignetteColor = new BABYLON.Color4(0.05, 0.0, 0.1, 1);
    pipeline.imageProcessing.exposure = preset.RENDERER.EXPOSURE;
    pipeline.imageProcessing.contrast = preset.RENDERER.CONTRAST;

    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType =
      BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;

    pipeline.chromaticAberrationEnabled = true;
    pipeline.chromaticAberration.aberrationAmount = 0.0;
    pipeline.chromaticAberration.radialIntensity = 1.2;
    this.pipeline = pipeline;

    this.scene!.lights.forEach((light) => {
      light.specular.set(0, 0, 0);
    });

    const shadowGen = new BABYLON.ShadowGenerator(preset.RENDERER.SHADOW_MAP_SIZE, dirLight);
    shadowGen.usePercentageCloserFiltering = true;
    shadowGen.filteringQuality = BABYLON.ShadowGenerator.QUALITY_MEDIUM;
    shadowGen.darkness = preset.RENDERER.SHADOW_DARKNESS;

    // This automatically registers shadows to already-spawned entities (Player/Weaver)
    this.visualRegistry.setSceneAndShadows(this.scene!, shadowGen);

    this.broker.publish(GameEvent.GAME_BOOT_PROGRESS, {
      status: "Building 3D arena geometry..."
    });

    const arenaGeo = new ArenaGeometry(this.scene!);
    await arenaGeo.generateElevatorShaft();

    this.broker.publish(GameEvent.GAME_BOOT_PROGRESS, {
      status: "Compiling shaders (this may take a moment)..."
    });

    const compilePromises: Promise<void>[] = [];
    this.scene!.materials.forEach((material) => {
      const activeMeshes = this.scene!.meshes.filter((m) => m.material === material);
      activeMeshes.forEach((mesh) => {
        if (typeof material.forceCompilationAsync === "function") {
          compilePromises.push(material.forceCompilationAsync(mesh));
        }
      });
    });

    if (compilePromises.length > 0) {
      await Promise.all(compilePromises).catch((err) => {
        console.warn("RenderSystem: Pre-compilation error:", err);
      });
    }

    await Promise.race([
      this.scene!.whenReadyAsync(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Shader compilation ready timeout")), 15000)
      )
    ]).catch((err) => {
      console.warn("RenderSystem: Ready check timeout or error:", err);
    });

    if (this.engine && this.scene) {
      this.engine.beginFrame();
      this.scene!.render();
      this.engine.endFrame();
    }

    this._tracker.add(
      this.broker.subscribe(GameEvent.PLAYER_DAMAGED, () => {
        if (this.pipeline) {
          this.pipeline.chromaticAberration.aberrationAmount = 45.0;
        }
      })
    );
    this._tracker.add(
      this.broker.subscribe(GameEvent.WEAVER_DAMAGED, () => {
        if (this.pipeline) {
          this.pipeline.chromaticAberration.aberrationAmount = 25.0;
        }
      })
    );
    this._tracker.add(
      this.broker.subscribe(GameEvent.PLAYER_STATE_CHANGE, (payload) => {
        if (
          payload.state === "LAUNCHING" &&
          payload.launchPower !== undefined &&
          payload.launchPower >= 0.72
        ) {
          if (this.pipeline) {
            this.pipeline.chromaticAberration.aberrationAmount = 20.0 * payload.launchPower;
          }
        }
      })
    );
    this._tracker.add(
      this.broker.subscribe(GameEvent.GAME_RESET, () => {
        if (this.pipeline) {
          this.pipeline.chromaticAberration.aberrationAmount = 0.0;
        }
      })
    );

    window.addEventListener("resize", this.handleResize);

    // Force aspect ratio and scaling update immediately on system initialization
    this.handleResize();
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
    if (this.scene && this.engine) {
      this.engine.beginFrame();
      this.scene.render();
      this.engine.endFrame();
    }
  }

  private handleResize = () => {
    if (this.engine) this.engine.resize();
  };

  public dispose(): void {
    window.removeEventListener("resize", this.handleResize);
    this._tracker.clear();
    this.visualRegistry.clear();
    if (this.scene) this.scene.dispose();
    if (this.engine) this.engine.dispose();

    // Clean up cache cleanly on teardown
    ProceduralTextureGenerator.clearCache();
  }
}
