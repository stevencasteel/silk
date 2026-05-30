import { Material, MaterialPluginBase, ShaderLanguage } from "@babylonjs/core";

export class AbdomenGradientPlugin extends MaterialPluginBase {
  constructor(material: Material) {
    super(material, "AbdomenGradient", 202, { ABDOMEN_GRADIENT: false });
    this._enable(true);
  }

  public prepareDefines(defines: Record<string, boolean>) {
    defines["ABDOMEN_GRADIENT"] = true;
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
            vAbdomenLocalY = positionUpdated.y;
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
          CUSTOM_FRAGMENT_UPDATE_EMISSIVE: `
            #ifdef ABDOMEN_GRADIENT
            // Isolate the yellow glow strictly to the cone part (Y < 0.0)
            // Fades out at the sphere-cone transition boundary (0.0)
            float gradientFactor = smoothstep(0.0, -0.8, vAbdomenLocalY);
            emissiveColor *= gradientFactor;
            #endif
          `
        };
      }
    }
    return null;
  }
}
