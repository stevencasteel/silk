import * as BABYLON from "@babylonjs/core";
import { IProceduralTextureGenerator, ProceduralTextureConfig } from "../../core/utils/EngineUtils";

interface TextureWorkerResponse {
  name: string;
  albedoBuffer: ArrayBuffer;
  normalBuffer: ArrayBuffer;
  ormBuffer: ArrayBuffer;
}

export class ProceduralTextureGenerator implements IProceduralTextureGenerator {
  private static textureCache = new Map<
    string,
    {
      albedo: BABYLON.DynamicTexture;
      normal: BABYLON.DynamicTexture;
      orm: BABYLON.DynamicTexture;
    }
  >();

  private static promiseCache = new Map<
    string,
    Promise<{
      albedo: BABYLON.DynamicTexture;
      normal: BABYLON.DynamicTexture;
      orm: BABYLON.DynamicTexture;
    }>
  >();

  public async generatePBRTextures(
    name: string,
    scene: BABYLON.Scene,
    config: ProceduralTextureConfig,
    onProgress?: (percent: number) => void
  ): Promise<{
    albedo: BABYLON.DynamicTexture;
    normal: BABYLON.DynamicTexture;
    orm: BABYLON.DynamicTexture;
  }> {
    const cached = ProceduralTextureGenerator.textureCache.get(name);
    if (cached) {
      if (onProgress) onProgress(1.0);
      return cached;
    }

    let pending = ProceduralTextureGenerator.promiseCache.get(name);
    if (!pending) {
      pending = this.executeGeneration(name, scene, config, onProgress);
      ProceduralTextureGenerator.promiseCache.set(name, pending);
    }

    return pending;
  }

  private executeGeneration(
    name: string,
    scene: BABYLON.Scene,
    config: ProceduralTextureConfig,
    onProgress?: (percent: number) => void
  ): Promise<{
    albedo: BABYLON.DynamicTexture;
    normal: BABYLON.DynamicTexture;
    orm: BABYLON.DynamicTexture;
  }> {
    return new Promise((resolve, reject) => {
      const res = config.resolution;
      const albedoTex = new BABYLON.DynamicTexture(`${name}_albedo`, res, scene, true);
      const normalTex = new BABYLON.DynamicTexture(`${name}_normal`, res, scene, true);
      const ormTex = new BABYLON.DynamicTexture(`${name}_orm`, res, scene, true);

      const worker = new Worker(new URL("./ProceduralTextureWorker.ts", import.meta.url), {
        type: "module"
      });

      worker.onmessage = (e: MessageEvent<TextureWorkerResponse>) => {
        const data = e.data;
        if (data.name === name) {
          const albedoCtx = albedoTex.getContext() as unknown as CanvasRenderingContext2D | null;
          const normalCtx = normalTex.getContext() as unknown as CanvasRenderingContext2D | null;
          const ormCtx = ormTex.getContext() as unknown as CanvasRenderingContext2D | null;

          if (albedoCtx && normalCtx && ormCtx) {
            const albedoImg = albedoCtx.createImageData(res, res);
            const normalImg = normalCtx.createImageData(res, res);
            const ormImg = ormCtx.createImageData(res, res);

            albedoImg.data.set(new Uint8ClampedArray(data.albedoBuffer));
            normalImg.data.set(new Uint8ClampedArray(data.normalBuffer));
            ormImg.data.set(new Uint8ClampedArray(data.ormBuffer));

            albedoCtx.putImageData(albedoImg, 0, 0);
            normalCtx.putImageData(normalImg, 0, 0);
            ormCtx.putImageData(ormImg, 0, 0);

            albedoTex.update();
            normalTex.update();
            ormTex.update();
          }

          const textures = { albedo: albedoTex, normal: normalTex, orm: ormTex };
          ProceduralTextureGenerator.textureCache.set(name, textures);
          ProceduralTextureGenerator.promiseCache.delete(name);

          if (onProgress) onProgress(1.0);
          worker.terminate();
          resolve(textures);
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(err);
      };

      const payload = {
        name,
        resolution: config.resolution,
        noiseScale: config.noiseScale,
        spaceScale: 1.0,
        bumpStrength: config.bumpStrength,
        baseColor: {
          r: config.baseColor.r,
          g: config.baseColor.g,
          b: config.baseColor.b
        },
        roughnessMin: config.roughnessMin,
        roughnessMax: config.roughnessMax,
        metallic: config.metallic,
        ridgeStrength: config.ridgeStrength,
        ridgeScale: config.ridgeScale,
        ridgeDirectionX: config.ridgeDirectionX,
        ridgeDirectionY: config.ridgeDirectionY,
        colorVariation: config.colorVariation
      };

      if (onProgress) onProgress(0.1);
      worker.postMessage(payload);
    });
  }

  public static clearCache(): void {
    ProceduralTextureGenerator.textureCache.forEach((texs) => {
      texs.albedo.dispose();
      texs.normal.dispose();
      texs.orm.dispose();
    });
    ProceduralTextureGenerator.textureCache.clear();
    ProceduralTextureGenerator.promiseCache.clear();
  }
}
