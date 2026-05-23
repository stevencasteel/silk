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
    this.scene.clearColor = new BABYLON.Color4(0.01, 0.01, 0.02, 1.0);
    
    // Adjusted camera Z-depth back to -38 to widen the frustum and bring 3D walls onto the portrait frame
    const camera = new BABYLON.FreeCamera("renderCamera", new BABYLON.Vector3(0, 14, -38), this.scene);
    camera.setTarget(new BABYLON.Vector3(0, 14, 0));
    camera.fovMode = BABYLON.Camera.FOVMODE_HORIZONTAL_FIXED;
    
    const light = new BABYLON.HemisphericLight("ambientLight", new BABYLON.Vector3(0, 1, 0), this.scene);
    light.intensity = 1.3;

    const arenaGeo = new ArenaGeometry(this.scene);
    arenaGeo.generateElevatorShaft();

    window.addEventListener("resize", this.handleResize);
  }

  public update(_dt: number): void {
    void _dt;
  }
  
  public render(_alpha: number): void { 
    void _alpha;
    if (this.scene) {
      this.scene.render();
    }
  }

  public getScene(): BABYLON.Scene | null { 
    return this.scene; 
  }
  
  public getTransformNode(id: EntityId): BABYLON.TransformNode | null { 
    return this.visualNodes.get(id) || null; 
  }
  
  public registerTransformNode(id: EntityId, node: BABYLON.TransformNode): void { 
    this.visualNodes.set(id, node); 
  }
  
  public unregisterTransformNode(id: EntityId): void { 
    const node = this.visualNodes.get(id); 
    if (node) { 
      node.dispose(); 
      this.visualNodes.delete(id); 
    } 
  }

  private handleResize = () => { 
    if (this.engine) {
      this.engine.resize();
    }
  };

  public dispose(): void { 
    window.removeEventListener("resize", this.handleResize); 
    if (this.scene) this.scene.dispose(); 
    if (this.engine) this.engine.dispose(); 
  }
}
