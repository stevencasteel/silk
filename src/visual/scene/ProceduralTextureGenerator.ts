import * as BABYLON from "@babylonjs/core";

export class ProceduralTextureGenerator {
  private p = new Uint8Array(256);

  constructor() {
    for (let i = 0; i < 256; i++) {
      this.p[i] = Math.floor(Math.sin(i) * 10000) & 255;
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

  public generatePBRTextures(
    name: string,
    scene: BABYLON.Scene,
    config: {
      resolution: number;
      noiseScale: number;
      bumpStrength: number;
      baseColor: BABYLON.Color3;
      roughnessMin: number;
      roughnessMax: number;
      metallic: number;
    }
  ): {
    albedo: BABYLON.DynamicTexture;
    normal: BABYLON.DynamicTexture;
    orm: BABYLON.DynamicTexture;
  } {
    const res = config.resolution;
    const albedoTex = new BABYLON.DynamicTexture(`${name}_albedo`, res, scene, true);
    const normalTex = new BABYLON.DynamicTexture(`${name}_normal`, res, scene, true);
    const ormTex = new BABYLON.DynamicTexture(`${name}_orm`, res, scene, true);

    // Cast the abstracted ICanvasRenderingContext safely to HTML5 CanvasRenderingContext2D
    const albedoCtx = albedoTex.getContext() as unknown as CanvasRenderingContext2D;
    const normalCtx = normalTex.getContext() as unknown as CanvasRenderingContext2D;
    const ormCtx = ormTex.getContext() as unknown as CanvasRenderingContext2D;

    const albedoImg = albedoCtx.createImageData(res, res);
    const normalImg = normalCtx.createImageData(res, res);
    const ormImg = ormCtx.createImageData(res, res);

    const heightMap = new Float32Array(res * res);
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const nx = (x / res) * config.noiseScale;
        const ny = (y / res) * config.noiseScale;
        heightMap[y * res + x] = this.fbm(nx, ny, 4);
      }
    }

    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const idx = (y * res + x) * 4;
        const h = heightMap[y * res + x];

        const xm = (x - 1 + res) % res;
        const xp = (x + 1) % res;
        const ym = (y - 1 + res) % res;
        const yp = (y + 1) % res;

        const hL = heightMap[y * res + xm];
        const hR = heightMap[y * res + xp];
        const hDown = heightMap[ym * res + x];
        const hUp = heightMap[yp * res + x];

        const dx = (hL - hR) * config.bumpStrength;
        const dy = (hDown - hUp) * config.bumpStrength;
        const dz = 1.0;

        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const nxVal = dx / len;
        const nyVal = dy / len;
        const nzVal = dz / len;

        normalImg.data[idx] = Math.floor((nxVal + 1.0) * 0.5 * 255);
        normalImg.data[idx + 1] = Math.floor((nyVal + 1.0) * 0.5 * 255);
        normalImg.data[idx + 2] = Math.floor((nzVal + 1.0) * 0.5 * 255);
        normalImg.data[idx + 3] = 255;

        const tint = 0.88 + h * 0.12;
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

    return { albedo: albedoTex, normal: normalTex, orm: ormTex };
  }
}
