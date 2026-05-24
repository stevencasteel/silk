import { Material, MaterialPluginBase, ShaderLanguage, UniformBuffer } from "@babylonjs/core";

export class WarpMaterialPlugin extends MaterialPluginBase {
  public warpIntensity = 0.0;
  public warpTime = 0.0;

  constructor(material: Material) {
    super(material, "Warp", 200, { WARP: false });
    this._enable(true);
  }

  public prepareDefines(defines: Record<string, boolean>) {
    defines["WARP"] = true;
  }

  public getClassName(): string {
    return "WarpMaterialPlugin";
  }

  public getUniforms() {
    return {
      "ubo": [
        { name: "u_warpIntensity", size: 1, type: "float" },
        { name: "u_warpTime", size: 1, type: "float" }
      ]
    };
  }

  public isCompatible(shaderLanguage: ShaderLanguage): boolean {
    return shaderLanguage === ShaderLanguage.GLSL;
  }

  public getCustomCode(shaderType: string, shaderLanguage: ShaderLanguage) {
    if (shaderType === "vertex") {
      if (shaderLanguage === ShaderLanguage.GLSL) {
        return {
          "CUSTOM_VERTEX_DEFINITIONS": `
            #ifdef WARP
            uniform float u_warpIntensity;
            uniform float u_warpTime;
            #endif
          `,
          "CUSTOM_VERTEX_UPDATE_POSITION": `
            #ifdef WARP
            float shiverCenter = 3.0 - u_warpTime * 10.5;
            float dist = abs(positionUpdated.y - shiverCenter);
            float envelope = max(0.0, 1.0 - dist / 1.5);
            positionUpdated.x += sin(positionUpdated.y * 24.0 + u_warpTime * 70.0) * envelope * u_warpIntensity * 1.30;
            #endif
          `
        };
      }
    }
    return null;
  }

  public bindForSubMesh(uniformBuffer: UniformBuffer): void {
    uniformBuffer.updateFloat("u_warpIntensity", this.warpIntensity);
    uniformBuffer.updateFloat("u_warpTime", this.warpTime);
  }
}
