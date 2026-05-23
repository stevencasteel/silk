import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { ArenaGeometry } from "../meshBuilders/ArenaGeometry";
import { EntityId } from "../../core/ecs/Entity";
import * as BABYLON from "@babylonjs/core";

export class RenderSystem implements ISystem, IVisualRegistry {
  readonly phase = SystemPhase.RenderSync;
  readonly initPhase = InitPhase.Bootstrap;
  
  private engine: BABYLON.Engine | null = null;
  private scene: BABYLON.Scene | null = null;
  private canvas: HTMLCanvasElement;
  private visualNodes = new Map<EntityId, BABYLON.TransformNode>();

  constructor(canvas: HTMLCanvasElement) { 
    this.canvas = canvas; 
  }

  public async init(): Promise<void> {
    this.engine = new BABYLON.Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true });
    this.scene = new BABYLON.Scene(this.engine);
    
    // 1. True deep black void to prevent milky wash-out
    this.scene.clearColor = new BABYLON.Color4(0.01, 0.01, 0.015, 1.0);
    
    const camera = new BABYLON.FreeCamera("renderCamera", new BABYLON.Vector3(0, 14, -38), this.scene);
    camera.setTarget(new BABYLON.Vector3(0, 14, 0));
    camera.fovMode = BABYLON.Camera.FOVMODE_HORIZONTAL_FIXED;
    
    // 2. STARK LIGHTING: Very dim ambient, strong directional spotlight
    const ambientLight = new BABYLON.HemisphericLight("ambientLight", new BABYLON.Vector3(0, 1, 0), this.scene);
    ambientLight.intensity = 0.2; // Keep shadows incredibly dark
    
    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-0.4, -0.6, 0.8), this.scene);
    dirLight.intensity = 2.5; // Strong rim/key light
    dirLight.specular = new BABYLON.Color3(1, 0.9, 0.8);

    // 3. Post-Processing: Fix exposure and contrast
    const pipeline = new BABYLON.DefaultRenderingPipeline("defaultPipeline", true, this.scene, [camera]);
    pipeline.samples = 4;
    pipeline.fxaaEnabled = true;
    
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.8; // Only let the brightest neon parts glow
    pipeline.bloomWeight = 0.6;

    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.vignetteEnabled = true;
    pipeline.imageProcessing.vignetteWeight = 2.0;
    pipeline.imageProcessing.vignetteColor = new BABYLON.Color4(0, 0, 0, 1);
    
    pipeline.imageProcessing.exposure = 1.0; // Restored from 1.2 to prevent wash-out
    pipeline.imageProcessing.contrast = 1.2; // Bumped contrast to make the lighting punchy

    pipeline.chromaticAberrationEnabled = true;
    pipeline.chromaticAberration.aberrationAmount = 2.0;

    const arenaGeo = new ArenaGeometry(this.scene);
    arenaGeo.generateElevatorShaft();

    window.addEventListener("resize", this.handleResize);
  }

  public update(_dt: number): void { }
  
  public render(_alpha: number): void { 
    if (this.scene) this.scene.render();
  }

  public getScene(): BABYLON.Scene | null { return this.scene; }
  public getTransformNode(id: EntityId): BABYLON.TransformNode | null { return this.visualNodes.get(id) || null; }
  public registerTransformNode(id: EntityId, node: BABYLON.TransformNode): void { this.visualNodes.set(id, node); }
  public unregisterTransformNode(id: EntityId): void { 
    const node = this.visualNodes.get(id); 
    if (node) { node.dispose(); this.visualNodes.delete(id); } 
  }

  private handleResize = () => { if (this.engine) this.engine.resize(); };
  public dispose(): void { 
    window.removeEventListener("resize", this.handleResize); 
    if (this.scene) this.scene.dispose(); 
    if (this.engine) this.engine.dispose(); 
  }
}
