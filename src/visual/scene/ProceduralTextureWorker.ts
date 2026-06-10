const ctx: Worker = self as unknown as Worker;

const p = new Uint8Array(256);
const permutation = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  permutation[i] = i;
}
for (let i = 255; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  const temp = permutation[i];
  permutation[i] = permutation[j];
  permutation[j] = temp;
}
for (let i = 0; i < 256; i++) {
  p[i] = permutation[i];
}

function noise(x: number, y: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;

  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  const u = xf * xf * (3.0 - 2.0 * xf);
  const v = yf * yf * (3.0 - 2.0 * yf);

  const aa = p[(p[X] + Y) & 255];
  const ab = p[(p[(X + 1) & 255] + Y) & 255];
  const ba = p[(p[X] + ((Y + 1) & 255)) & 255];
  const bb = p[(p[(X + 1) & 255] + ((Y + 1) & 255)) & 255];

  const val = (1 - v) * ((1 - u) * aa + u * ab) + v * ((1 - u) * ba + u * bb);
  return val / 255;
}

function fbm(x: number, y: number, octaves: number = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1.0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise(x * frequency, y * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

ctx.onmessage = (e: MessageEvent) => {
  const config = e.data;
  const res = config.resolution;

  const albedoBuffer = new ArrayBuffer(res * res * 4);
  const normalBuffer = new ArrayBuffer(res * res * 4);
  const ormBuffer = new ArrayBuffer(res * res * 4);

  const albedoData = new Uint8ClampedArray(albedoBuffer);
  const normalData = new Uint8ClampedArray(normalBuffer);
  const ormData = new Uint8ClampedArray(ormBuffer);

  const heightMap = new Float32Array(res * res);

  const ridgeScale = config.ridgeScale ?? 0;
  const ridgeStrength = config.ridgeStrength ?? 0;
  const noiseScale = config.noiseScale;
  const bumpStrength = config.bumpStrength;
  const baseColor = config.baseColor;
  const roughnessMin = config.roughnessMin;
  const roughnessMax = config.roughnessMax;
  const metallic = config.metallic;
  const colorVariation = config.colorVariation ?? 0.12;

  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const nx = (x / res) * noiseScale;
      const ny = (y / res) * noiseScale;
      const warp = fbm(nx * 0.33 + 11.7, ny * 0.33 - 5.2, 3);
      const lowNoise = fbm(nx, ny, 4);
      const fineNoise = fbm(nx * 2.6 + 19.1, ny * 2.6 - 3.4, 3);

      let ridge = 0.0;
      if (ridgeScale > 0) {
        const dirX = config.ridgeDirectionX ?? 0.25;
        const dirY = config.ridgeDirectionY ?? 1.0;
        const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1.0;
        const ridgeCoord = (nx * dirX + ny * dirY) / len;
        ridge = 1.0 - Math.abs(Math.sin((ridgeCoord * ridgeScale + warp * 1.8) * Math.PI));
      }

      const height = lowNoise * 0.72 + fineNoise * 0.18 + ridge * ridgeStrength;
      heightMap[y * res + x] = Math.min(1.0, Math.max(0.0, height));
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

      const hTL = heightMap[ym * res + xm];
      const hTR = heightMap[ym * res + xp];
      const hBL = heightMap[yp * res + xm];
      const hBR = heightMap[yp * res + xp];

      const dx = (hTR + hBR - (hTL + hBL)) * bumpStrength * 0.5;
      const dy = (hBL + hBR - (hTL + hTR)) * bumpStrength * 0.5;
      const dz = 1.0;

      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const nxVal = dx / len;
      const nyVal = dy / len;
      const nzVal = dz / len;

      normalData[idx] = Math.floor((nxVal + 1.0) * 0.5 * 255);
      normalData[idx + 1] = Math.floor((nyVal + 1.0) * 0.5 * 255);
      normalData[idx + 2] = Math.floor((nzVal + 1.0) * 0.5 * 255);
      normalData[idx + 3] = 255;

      const pore = fbm((x / res) * noiseScale * 4.5 + 3.1, (y / res) * noiseScale * 4.5, 2);
      const tint = 0.86 + h * colorVariation + (pore - 0.5) * colorVariation * 0.35;
      albedoData[idx] = Math.min(255, Math.max(0, baseColor.r * 255 * tint));
      albedoData[idx + 1] = Math.min(255, Math.max(0, baseColor.g * 255 * tint));
      albedoData[idx + 2] = Math.min(255, Math.max(0, baseColor.b * 255 * tint));
      albedoData[idx + 3] = 255;

      const ao = Math.floor((1.0 - (1.0 - h) * 0.3) * 255);
      const roughness = Math.floor(
        (roughnessMin + (1.0 - h) * (roughnessMax - roughnessMin)) * 255
      );
      const metallicVal = Math.floor(metallic * 255);

      ormData[idx] = ao;
      ormData[idx + 1] = roughness;
      ormData[idx + 2] = metallicVal;
      ormData[idx + 3] = 255;
    }
  }

  ctx.postMessage(
    {
      name: config.name,
      albedoBuffer,
      normalBuffer,
      ormBuffer
    },
    [albedoBuffer, normalBuffer, ormBuffer]
  );
};
