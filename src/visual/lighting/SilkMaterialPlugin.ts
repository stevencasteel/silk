import { Material, MaterialPluginBase, ShaderLanguage, UniformBuffer, Color3, PBRMaterial } from "@babylonjs/core";

export class SilkMaterialPlugin extends MaterialPluginBase {
  public shearIntensity = 0.0;
  public shearTime = 0.0;
  public time = 0.0;

  public shearActive = false;
  public gradientActive = false;
  public noiseActive = false;

  constructor(material: Material, options?: { shear?: boolean; gradient?: boolean; noise?: boolean }) {
    super(material, "SilkMaterialEffects", 200, {
      SHEAR: false,
      ABDOMEN_GRADIENT: false,
      NOISE: false
    });
    
    this.shearActive = options?.shear ?? false;
    this.gradientActive = options?.gradient ?? false;
    this.noiseActive = options?.noise ?? false;

    this._enable(true);

    if (this.gradientActive) {
      const pbr = material as PBRMaterial;
      if (pbr) {
        pbr.emissiveColor = new Color3(0.05, 0.0, 0.1);
      }
    }
  }

  public prepareDefines(defines: Record<string, boolean>) {
    defines["SHEAR"] = this.shearActive;
    defines["ABDOMEN_GRADIENT"] = this.gradientActive;
    defines["NOISE"] = this.noiseActive;
  }

  public getClassName(): string {
    return "SilkMaterialPlugin";
  }

  public getUniforms() {
    return {
      ubo: [
        { name: "u_shearIntensity", size: 1, type: "float" },
        { name: "u_shearTime", size: 1, type: "float" },
        { name: "u_noiseTime", size: 1, type: "float" }
      ]
    };
  }

  public isCompatible(shaderLanguage: ShaderLanguage): boolean {
    return shaderLanguage === ShaderLanguage.GLSL;
  }

  public bindForSubMesh(uniformBuffer: UniformBuffer): void {
    if (this.shearActive) {
      uniformBuffer.updateFloat("u_shearIntensity", this.shearIntensity);
      uniformBuffer.updateFloat("u_shearTime", this.shearTime);
    }
    if (this.noiseActive) {
      uniformBuffer.updateFloat("u_noiseTime", this.time);
    }
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

            #ifdef NOISE
            uniform float u_noiseTime;
            varying vec3 vLocalPos;

            float getNoiseVal(vec3 pos, float time) {
                float n = sin(pos.x * 2.0 + time * 5.0) * 
                          cos(pos.y * 2.3 + time * 6.3) * 
                          sin(pos.z * 2.6 + time * 4.1);
                n += sin(pos.y * 5.0 - time * 11.0) * 0.35;
                return n * 0.24;
            }
            #endif

            #ifdef ABDOMEN_GRADIENT
            varying float vAbdomenLocalY;
            #endif
          `,
          CUSTOM_VERTEX_UPDATE_POSITION: `
            #ifdef SHEAR
            float displacement = getShearDisplacement(positionUpdated, u_shearIntensity, u_shearTime);

            #ifdef NORMAL
            vec3 originalNormalShear = normalUpdated;
            #endif

            float epsShear = 0.02;
            float hLShear = displacement;
            
            float hR_yShear = getShearDisplacement(positionUpdated + vec3(0.0, epsShear, 0.0), u_shearIntensity, u_shearTime);
            float d_dyShear = (hR_yShear - hLShear) / epsShear;

            positionUpdated.x += displacement;

            #ifdef NORMAL
            normalUpdated.x -= d_dyShear * 0.35;
            normalUpdated = normalize(normalUpdated);
            #endif
            #endif

            #ifdef NOISE
            vLocalPos = positionUpdated;
            float noiseVal = getNoiseVal(positionUpdated, u_noiseTime);

            #ifdef NORMAL
            vec3 originalNormalNoise = normalUpdated;
            #else
            vec3 originalNormalNoise = length(positionUpdated) > 0.0 ? normalize(positionUpdated) : vec3(0.0, 1.0, 0.0);
            #endif

            float epsNoise = 0.02;
            float hLNoise = noiseVal;
            float hR_xNoise = getNoiseVal(positionUpdated + vec3(epsNoise, 0.0, 0.0), u_noiseTime);
            float hR_yNoise = getNoiseVal(positionUpdated + vec3(0.0, epsNoise, 0.0), u_noiseTime);
            float hR_zNoise = getNoiseVal(positionUpdated + vec3(0.0, 0.0, epsNoise), u_noiseTime);

            vec3 gradNoise = vec3(hR_xNoise - hLNoise, hR_yNoise - hLNoise, hR_zNoise - hLNoise) / epsNoise;

            positionUpdated += originalNormalNoise * noiseVal;

            #ifdef NORMAL
            normalUpdated = normalize(originalNormalNoise - gradNoise * 0.5);
            #endif
            #endif

            #ifdef ABDOMEN_GRADIENT
            vAbdomenLocalY = position.y;
            #endif
          `
        };
      } else if (shaderType === "fragment") {
        return {
          CUSTOM_FRAGMENT_DEFINITIONS: `
            #ifdef NOISE
            uniform float u_noiseTime;
            varying vec3 vLocalPos;
            #endif

            #ifdef ABDOMEN_GRADIENT
            varying float vAbdomenLocalY;
            #endif
          `,
          CUSTOM_FRAGMENT_BEFORE_LIGHTS: `
            #ifdef NOISE
            #ifdef NORMAL
            vec3 pos = vLocalPos;
            float epsF = 0.005;
            float hLF = sin(pos.x * 12.0 + u_noiseTime * 15.0) * sin(pos.y * 12.0 - u_noiseTime * 12.0) * sin(pos.z * 12.0 + u_noiseTime * 18.0) * 0.09;
            float hR_xF = sin((pos.x + epsF) * 12.0 + u_noiseTime * 15.0) * sin(pos.y * 12.0 - u_noiseTime * 12.0) * sin(pos.z * 12.0 + u_noiseTime * 18.0) * 0.09;
            float hR_yF = sin(pos.x * 12.0 + u_noiseTime * 15.0) * sin((pos.y + epsF) * 12.0 - u_noiseTime * 12.0) * sin(pos.z * 12.0 + u_noiseTime * 18.0) * 0.09;
            float hR_zF = sin(pos.x * 12.0 + u_noiseTime * 15.0) * sin(pos.y * 12.0 - u_noiseTime * 12.0) * sin((pos.z + epsF) * 12.0 + u_noiseTime * 18.0) * 0.09;

            vec3 gradF = vec3(hR_xF - hLF, hR_yF - hLF, hR_zF - hLF) / epsF;

            normalW = normalize(normalW - gradF * 0.15);
            #endif
            #endif
          `,
          CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `
            #ifdef ABDOMEN_GRADIENT
            #ifdef EMISSIVE
            if (vEmissiveColor.g > 0.3) {
                float distFromEquator = max(0.0, -vAbdomenLocalY);
                float gradientFactor = smoothstep(0.0, 3.4, distFromEquator);
                gradientFactor = pow(gradientFactor, 2.5);
                
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
