import * as BABYLON from "@babylonjs/core";

export class MaterialRegistry {
  private compiledMaterials = new Map<string, BABYLON.Material>();

  public getMaterial(key: string): BABYLON.Material | undefined {
    return this.compiledMaterials.get(key);
  }
}
