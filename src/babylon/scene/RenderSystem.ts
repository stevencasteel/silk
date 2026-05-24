import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { ArenaGeometry } from "../meshBuilders/ArenaGeometry";
import { EntityId } from "../../core/ecs/Entity";
import * as BABYLON from "@babylonjs/core";

export class RenderSystem implements ISystem, IVisualRegistry {
  readonly phase = SystemPhase.PostRender;
  readonly initPhase = InitPhase.Bootstrap;
  private engine: BABYLON.Engine | null = null;
  private scene: BABYLON.Scene | null = null;
  private canvas: HTMLCanvasElement;
  private visualNodes = new Map<EntityId, BABYLON.TransformNode>();
  private shadowGen: BABYLON.ShadowGenerator | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  public async init(): Promise<void> {
    this.engine = new BABYLON.Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true
    });
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.01, 0.01, 0.012, 1.0);

    const camera = new BABYLON.FreeCamera(
      "renderCamera",
      new BABYLON.Vector3(0, 14, -38),
      this.scene
    );
    camera.setTarget(new BABYLON.Vector3(0, 14, 0));
    camera.fovMode = BABYLON.Camera.FOVMODE_HORIZONTAL_FIXED;

    const ambientLight = new BABYLON.HemisphericLight(
      "ambientLight",
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );
    ambientLight.intensity = 0.08;

    const dirLight = new BABYLON.DirectionalLight(
      "dirLight",
      new BABYLON.Vector3(-0.3, -0.8, 0.5),
      this.scene
    );
    dirLight.intensity = 3.2;
    dirLight.specular = new BABYLON.Color3(0.9, 0.9, 0.95);

    const pipeline = new BABYLON.DefaultRenderingPipeline("defaultPipeline", true, this.scene, [
      camera
    ]);
    pipeline.samples = 4;
    pipeline.fxaaEnabled = true;
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.6;
    pipeline.bloomWeight = 1.2;
    pipeline.bloomKernel = 64;
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.vignetteEnabled = true;
    pipeline.imageProcessing.vignetteWeight = 2.8;
    pipeline.imageProcessing.vignetteColor = new BABYLON.Color4(0, 0, 0, 1);
    pipeline.imageProcessing.exposure = 0.9;
    pipeline.imageProcessing.contrast = 1.45;
    pipeline.chromaticAberrationEnabled = false;

    const shadowGen = new BABYLON.ShadowGenerator(1024, dirLight);
    shadowGen.useBlurExponentialShadowMap = true;
    shadowGen.blurKernel = 16;
    shadowGen.darkness = 0.6;
    this.shadowGen = shadowGen;

    const arenaGeo = new ArenaGeometry(this.scene);
    arenaGeo.generateElevatorShaft();

    window.addEventListener("resize", this.handleResize);
  }

  public update(): void {}

  public render(): void {
    if (this.scene) this.scene.render();
  }

  public getScene(): BABYLON.Scene | null {
    return this.scene;
  }
  public getTransformNode(id: EntityId): BABYLON.TransformNode | null {
    return this.visualNodes.get(id) || null;
  }
  public registerTransformNode(id: EntityId, node: BABYLON.TransformNode): void {
    this.visualNodes.set(id, node);
    if (this.shadowGen && node instanceof BABYLON.AbstractMesh) {
      this.shadowGen.addShadowCaster(node);
      node.receiveShadows = true;
    }
  }
  public unregisterTransformNode(id: EntityId): void {
    const node = this.visualNodes.get(id);
    if (node) {
      node.dispose();
      this.visualNodes.delete(id);
    }
  }

  private handleResize = () => {
    if (this.engine) this.engine.resize();
  };

  public dispose(): void {
    window.removeEventListener("resize", this.handleResize);
    if (this.scene) this.scene.dispose();
    if (this.engine) this.engine.dispose();
  }
}
