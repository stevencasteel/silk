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

  public getCustomCode(shaderType: string, shaderLanguage?: ShaderLanguage): Record<string, string> | null {
    if (shaderLanguage === ShaderLanguage.GLSL) {
      if (shaderType === "vertex") {
        return {
          "CUSTOM_VERTEX_DEFINITIONS": `
            #ifdef WARP
            uniform float u_warpIntensity;
            uniform float u_warpTime;

            float getWarpDisplacement(vec3 pos, float intensity, float time) {
                // Quantize vertical position to simulate coarse SNES horizontal tile lines
                float tileSize = 0.16;
                float quantizedY = floor(pos.y / tileSize) * tileSize;

                // Scanner envelope sweeping from head to toe
                float shiverCenter = 2.5 - time * 10.0;
                float dist = abs(pos.y - shiverCenter);
                float envelope = max(0.0, 1.0 - dist / 1.8);

                // Scrolling wave based on quantized tile row
                float wave = sin(quantizedY * 20.0 + time * 75.0);

                // Quantize the horizontal offset amount to create retro "pixel steps"
                float pixelStep = 0.06;
                float steppedWave = floor(wave / pixelStep) * pixelStep;

                return steppedWave * envelope * intensity * 0.45;
            }
            #endif
          `,
          "CUSTOM_VERTEX_UPDATE_POSITION": `
            #ifdef WARP
            float displacement = getWarpDisplacement(positionUpdated, u_warpIntensity, u_warpTime);

            #ifdef NORMAL
            vec3 originalNormal = normalUpdated;
            #endif

            float eps = 0.02;
            float hL = displacement;
            
            // Only need to sample Y+eps because the displacement only varies vertically (Y)
            float hR_y = getWarpDisplacement(positionUpdated + vec3(0.0, eps, 0.0), u_warpIntensity, u_warpTime);
            float d_dy = (hR_y - hL) / eps;

            // Shift ONLY the horizontal X axis to produce the 2D PPU raster effect
            positionUpdated.x += displacement;

            #ifdef NORMAL
            // Offset normal's X coordinate according to the shearing slope (Y-derivative)
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
    uniformBuffer.updateFloat("u_warpIntensity", this.warpIntensity);
    uniformBuffer.updateFloat("u_warpTime", this.warpTime);
  }
}
