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

  public getCustomCode(shaderType: string, shaderLanguage?: ShaderLanguage): Record<string, string> | null {
    if (shaderLanguage === ShaderLanguage.GLSL) {
      if (shaderType === "vertex") {
        return {
          "CUSTOM_VERTEX_DEFINITIONS": `
            #ifdef NOISE
            uniform float u_noiseTime;

            float getNoiseVal(vec3 pos, float time) {
                float n = sin(pos.x * 6.0 + time * 5.0) * 
                          cos(pos.y * 7.0 + time * 6.3) * 
                          sin(pos.z * 8.0 + time * 4.1);
                n += sin(pos.y * 15.0 - time * 11.0) * 0.35;
                return n * 0.08;
            }
            #endif
          `,
          "CUSTOM_VERTEX_UPDATE_POSITION": `
            #ifdef NOISE
            float noiseVal = getNoiseVal(positionUpdated, u_noiseTime);

            #ifdef NORMAL
            vec3 originalNormal = normalUpdated;
            #else
            vec3 originalNormal = length(positionUpdated) > 0.0 ? normalize(positionUpdated) : vec3(0.0, 1.0, 0.0);
            #endif

            float eps = 0.02;
            float hL = noiseVal;
            float hR_x = getNoiseVal(positionUpdated + vec3(eps, 0.0, 0.0), u_noiseTime);
            float hR_y = getNoiseVal(positionUpdated + vec3(0.0, eps, 0.0), u_noiseTime);
            float hR_z = getNoiseVal(positionUpdated + vec3(0.0, 0.0, eps), u_noiseTime);

            vec3 grad = vec3(hR_x - hL, hR_y - hL, hR_z - hL) / eps;

            positionUpdated += originalNormal * noiseVal;

            #ifdef NORMAL
            normalUpdated = normalize(originalNormal - grad * 0.5);
            #endif
            #endif
          `
        };
      } else if (shaderType === "fragment") {
        return {
          "CUSTOM_FRAGMENT_DEFINITIONS": `
            #ifdef NOISE
            uniform float u_noiseTime;
            #endif
          `,
          "CUSTOM_FRAGMENT_BEFORE_LIGHTS": `
            #ifdef NOISE
            #ifdef NORMAL
            vec3 pos = vPositionW;
            float epsF = 0.005;
            float hLF = sin(pos.x * 35.0 + u_noiseTime * 15.0) * sin(pos.y * 35.0 - u_noiseTime * 12.0) * sin(pos.z * 35.0 + u_noiseTime * 18.0) * 0.03;
            float hR_xF = sin((pos.x + epsF) * 35.0 + u_noiseTime * 15.0) * sin(pos.y * 35.0 - u_noiseTime * 12.0) * sin(pos.z * 35.0 + u_noiseTime * 18.0) * 0.03;
            float hR_yF = sin(pos.x * 35.0 + u_noiseTime * 15.0) * sin((pos.y + epsF) * 35.0 - u_noiseTime * 12.0) * sin(pos.z * 35.0 + u_noiseTime * 18.0) * 0.03;
            float hR_zF = sin(pos.x * 35.0 + u_noiseTime * 15.0) * sin(pos.y * 35.0 - u_noiseTime * 12.0) * sin((pos.z + epsF) * 35.0 + u_noiseTime * 18.0) * 0.03;

            vec3 gradF = vec3(hR_xF - hLF, hR_yF - hLF, hR_zF - hLF) / epsF;

            normalW = normalize(normalW - gradF * 0.15);
            #endif
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
