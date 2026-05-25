import { Material, MaterialPluginBase, ShaderLanguage, UniformBuffer } from "@babylonjs/core";

export class RasterShearPlugin extends MaterialPluginBase {
  public shearIntensity = 0.0;
  public shearTime = 0.0;

  constructor(material: Material) {
    super(material, "RasterShear", 200, { SHEAR: false });
    this._enable(true);
  }

  public prepareDefines(defines: Record<string, boolean>) {
    defines["SHEAR"] = true;
  }

  public getClassName(): string {
    return "RasterShearPlugin";
  }

  public getUniforms() {
    return {
      ubo: [
        { name: "u_shearIntensity", size: 1, type: "float" },
        { name: "u_shearTime", size: 1, type: "float" }
      ]
    };
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
            #ifdef SHEAR
            uniform float u_shearIntensity;
            uniform float u_shearTime;

            float getShearDisplacement(vec3 pos, float intensity, float time) {
                float tileSize = 0.16;
                float quantizedY = floor(pos.y / tileSize) * tileSize;

                float shiverCenter = 2.5 - time * 10.0;
                float dist = abs(pos.y - shiverCenter);
                float envelope = max(0.0, 1.0 - dist / 1.8);

                float wave = sin(quantizedY * 20.0 + time * 75.0);

                float pixelStep = 0.06;
                float steppedWave = floor(wave / pixelStep) * pixelStep;

                return steppedWave * envelope * intensity * 0.45;
            }
            #endif
          `,
          CUSTOM_VERTEX_UPDATE_POSITION: `
            #ifdef SHEAR
            float displacement = getShearDisplacement(positionUpdated, u_shearIntensity, u_shearTime);

            #ifdef NORMAL
            vec3 originalNormal = normalUpdated;
            #endif

            float eps = 0.02;
            float hL = displacement;
            
            float hR_y = getShearDisplacement(positionUpdated + vec3(0.0, eps, 0.0), u_shearIntensity, u_shearTime);
            float d_dy = (hR_y - hL) / eps;

            positionUpdated.x += displacement;

            #ifdef NORMAL
            normalUpdated.x -= d_dy * 0.35;
            normalUpdated = normalize(normalUpdated);
            #endif
            #endif
          `
        };
      }
    }
    return null;
  }

  public bindForSubMesh(uniformBuffer: UniformBuffer): void {
    uniformBuffer.updateFloat("u_shearIntensity", this.shearIntensity);
    uniformBuffer.updateFloat("u_shearTime", this.shearTime);
  }
}
