import * as BABYLON from "@babylonjs/core";
import { IProceduralTextureGenerator, ProceduralTextureConfig } from "../../core/utils/EngineUtils";

export class ProceduralTextureGenerator implements IProceduralTextureGenerator {
  private p = new Uint8Array(256);
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

  constructor() {
    const permutation = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      permutation[i] = i;
    }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }
    for (let i = 0; i < 256; i++) {
      this.p[i] = permutation[i];
    }
  }

  private noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = xf * xf * (3.0 - 2.0 * xf);
    const v = yf * yf * (3.0 - 2.0 * yf);

    const aa = this.p[(this.p[X] + Y) & 255];
    const ab = this.p[(this.p[(X + 1) & 255] + Y) & 255];
    const ba = this.p[(this.p[X] + ((Y + 1) & 255)) & 255];
    const bb = this.p[(this.p[(X + 1) & 255] + ((Y + 1) & 255)) & 255];

    const val = (1 - v) * ((1 - u) * aa + u * ab) + v * ((1 - u) * ba + u * bb);
    return val / 255;
  }

  public fbm(x: number, y: number, octaves: number = 4): number {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1.0;
    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise(x * frequency, y * frequency);
      frequency *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

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

  private async executeGeneration(
    name: string,
    scene: BABYLON.Scene,
    config: ProceduralTextureConfig,
    onProgress?: (percent: number) => void
  ): Promise<{
    albedo: BABYLON.DynamicTexture;
    normal: BABYLON.DynamicTexture;
    orm: BABYLON.DynamicTexture;
  }> {
    const res = config.resolution;
    const albedoTex = new BABYLON.DynamicTexture(`${name}_albedo`, res, scene, true);
    const normalTex = new BABYLON.DynamicTexture(`${name}_normal`, res, scene, true);
    const ormTex = new BABYLON.DynamicTexture(`${name}_orm`, res, scene, true);

    const albedoCtx = albedoTex.getContext() as unknown as CanvasRenderingContext2D;
    const normalCtx = normalTex.getContext() as unknown as CanvasRenderingContext2D;
    const ormCtx = ormTex.getContext() as unknown as CanvasRenderingContext2D;

    const albedoImg = albedoCtx.createImageData(res, res);
    const normalImg = normalCtx.createImageData(res, res);
    const ormImg = ormCtx.createImageData(res, res);

    const heightMap = new Float32Array(res * res);
    for (let y = 0; y < res; y++) {
      if (y % 32 === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        if (onProgress) onProgress((y / res) * 0.45);
      }
      for (let x = 0; x < res; x++) {
        const nx = (x / res) * config.noiseScale;
        const ny = (y / res) * config.noiseScale;
        const warp = this.fbm(nx * 0.33 + 11.7, ny * 0.33 - 5.2, 3);
        const lowNoise = this.fbm(nx, ny, 4);
        const fineNoise = this.fbm(nx * 2.6 + 19.1, ny * 2.6 - 3.4, 3);
        const ridgeScale = config.ridgeScale ?? 0;

        let ridge = 0.0;
        if (ridgeScale > 0) {
          const dirX = config.ridgeDirectionX ?? 0.25;
          const dirY = config.ridgeDirectionY ?? 1.0;
          const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1.0;
          const ridgeCoord = (nx * dirX + ny * dirY) / len;
          ridge = 1.0 - Math.abs(Math.sin((ridgeCoord * ridgeScale + warp * 1.8) * Math.PI));
        }

        const ridgeStrength = config.ridgeStrength ?? 0;
        const height = lowNoise * 0.72 + fineNoise * 0.18 + ridge * ridgeStrength;
        heightMap[y * res + x] = Math.min(1.0, Math.max(0.0, height));
      }
    }

    for (let y = 0; y < res; y++) {
      if (y % 32 === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        if (onProgress) onProgress(0.45 + (y / res) * 0.55);
      }
      for (let x = 0; x < res; x++) {
        const idx = (y * res + x) * 4;
        const h = heightMap[y * res + x];

        const xm = (x - 1 + res) % res;
        const xp = (x + 1) % res;
        const ym = (y - 1 + res) % res;
        const yp = (y + 1) % res;

        const hTL = heightMap[ym * res + xm];
        const hTR = heightMap[ym * res + xp];
        const hBL = heightMap[yp * res + xm];
        const hBR = heightMap[yp * res + xp];

        const dx = (hTR + hBR - (hTL + hBL)) * config.bumpStrength * 0.5;
        const dy = (hBL + hBR - (hTL + hTR)) * config.bumpStrength * 0.5;
        const dz = 1.0;

        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const nxVal = dx / len;
        const nyVal = dy / len;
        const nzVal = dz / len;

        normalImg.data[idx] = Math.floor((nxVal + 1.0) * 0.5 * 255);
        normalImg.data[idx + 1] = Math.floor((nyVal + 1.0) * 0.5 * 255);
        normalImg.data[idx + 2] = Math.floor((nzVal + 1.0) * 0.5 * 255);
        normalImg.data[idx + 3] = 255;

        const variation = config.colorVariation ?? 0.12;
        const pore = this.fbm(
          (x / res) * config.noiseScale * 4.5 + 3.1,
          (y / res) * config.noiseScale * 4.5,
          2
        );
        const tint = 0.86 + h * variation + (pore - 0.5) * variation * 0.35;
        albedoImg.data[idx] = Math.min(255, Math.max(0, config.baseColor.r * 255 * tint));
        albedoImg.data[idx + 1] = Math.min(255, Math.max(0, config.baseColor.g * 255 * tint));
        albedoImg.data[idx + 2] = Math.min(255, Math.max(0, config.baseColor.b * 255 * tint));
        albedoImg.data[idx + 3] = 255;

        const ao = Math.floor((1.0 - (1.0 - h) * 0.3) * 255);
        const roughness = Math.floor(
          (config.roughnessMin + (1.0 - h) * (config.roughnessMax - config.roughnessMin)) * 255
        );
        const metallic = Math.floor(config.metallic * 255);

        ormImg.data[idx] = ao;
        ormImg.data[idx + 1] = roughness;
        ormImg.data[idx + 2] = metallic;
        ormImg.data[idx + 3] = 255;
      }
    }

    albedoCtx.putImageData(albedoImg, 0, 0);
    normalCtx.putImageData(normalImg, 0, 0);
    ormCtx.putImageData(ormImg, 0, 0);

    albedoTex.update();
    normalTex.update();
    ormTex.update();

    const textures = { albedo: albedoTex, normal: normalTex, orm: ormTex };
    
    ProceduralTextureGenerator.textureCache.set(name, textures);
    ProceduralTextureGenerator.promiseCache.delete(name);

    if (onProgress) onProgress(1.0);
    return textures;
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
