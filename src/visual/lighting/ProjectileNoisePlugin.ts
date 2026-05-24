import { Material, MaterialPluginBase, ShaderLanguage, UniformBuffer } from "@babylonjs/core";

export class ProjectileNoisePlugin extends MaterialPluginBase {
  public time = 0.0;

  constructor(material: Material) {
    super(material, "ProjectileNoise", 201, { NOISE: false });
    this._enable(true);
  }

  public prepareDefines(defines: Record<string, boolean>) {
    defines["NOISE"] = true;
  }

  public getClassName(): string {
    return "ProjectileNoisePlugin";
  }

  public getUniforms() {
    return {
      "ubo": [
        { name: "u_noiseTime", size: 1, type: "float" }
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
            #ifdef NOISE
            uniform float u_noiseTime;
            #endif
          `,
          "CUSTOM_VERTEX_UPDATE_POSITION": `
            #ifdef NOISE
            float noiseVal = sin(positionUpdated.x * 6.0 + u_noiseTime * 5.0) * 
                             cos(positionUpdated.y * 7.0 + u_noiseTime * 6.3) * 
                             sin(positionUpdated.z * 8.0 + u_noiseTime * 4.1);
            noiseVal += sin(positionUpdated.y * 15.0 - u_noiseTime * 11.0) * 0.35;
            positionUpdated += normalUpdated * noiseVal * 0.08;
            #endif
          `
        };
      }
    }
    return null;
  }

  public bindForSubMesh(uniformBuffer: UniformBuffer): void {
    uniformBuffer.updateFloat("u_noiseTime", this.time);
  }
}
