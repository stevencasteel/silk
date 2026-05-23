export class MaterialRegistry {
  private compiledMaterials = new Map<string, any>();

  public getMaterial(key: string): any {
    return this.compiledMaterials.get(key);
  }
}
