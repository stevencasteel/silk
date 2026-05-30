import { Material, MaterialPluginBase, ShaderLanguage, Color3, PBRMaterial, MaterialDefines, Scene, AbstractMesh } from "@babylonjs/core";

export class AbdomenGradientPlugin extends MaterialPluginBase {
  constructor(material: Material) {
    super(material, "AbdomenGradient", 202, { ABDOMEN_GRADIENT: false });
    this._enable(true);

    const pbr = material as PBRMaterial;
    if (pbr) {
      pbr.emissiveColor = new Color3(0.05, 0.0, 0.1);
    }
    material.markAsDirty(Material.AllDirtyFlag);
  }

  public prepareDefines(defines: MaterialDefines, scene: Scene, mesh?: AbstractMesh) {
    void scene;
    void mesh;
    const customDefines = defines as Record<string, unknown>;
    customDefines.ABDOMEN_GRADIENT = true;
  }

  public getClassName(): string {
    return "AbdomenGradientPlugin";
  }

  public isCompatible(shaderLanguage: ShaderLanguage): boolean {
    return shaderLanguage === ShaderLanguage.GLSL;
  }

  public getCustomCode(
    shaderType: string,
    shaderLanguage?: ShaderLanguage
  ): Record<string, string> | null {
    if (shaderLanguage === ShaderLanguage.GLSL) {
      if (shaderType === "vertex") {
        return {
          CUSTOM_VERTEX_DEFINITIONS: `
            #ifdef ABDOMEN_GRADIENT
            varying float vAbdomenLocalY;
            #endif
          `,
          CUSTOM_VERTEX_UPDATE_POSITION: `
            #ifdef ABDOMEN_GRADIENT
            vAbdomenLocalY = position.y;
            #endif
          `
        };
      } else if (shaderType === "fragment") {
        return {
          CUSTOM_FRAGMENT_DEFINITIONS: `
            #ifdef ABDOMEN_GRADIENT
            varying float vAbdomenLocalY;
            #endif
          `,
          CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `
            #ifdef ABDOMEN_GRADIENT
            #ifdef EMISSIVE
            // Apply only to the yellow warning telegraph color (green > 0.3)
            if (vEmissiveColor.g > 0.3) {
                float distFromEquator = max(0.0, -vAbdomenLocalY);
                float gradientFactor = smoothstep(0.0, 3.4, distFromEquator);
                gradientFactor = pow(gradientFactor, 2.5);
                
                // Subtract flat emissive contribution, then add back the gradient-attenuated emissive
                finalColor.rgb -= finalEmissive;
                finalColor.rgb += finalEmissive * gradientFactor;
            }
            #endif
            #endif
          `
        };
      }
    }
    return null;
  }
}
