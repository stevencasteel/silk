import * as BABYLON from "@babylonjs/core";

export function solveSpringDamper(
  current: number,
  target: number,
  velocity: number,
  dt: number,
  stiffness: number,
  damping: number
): { value: number; velocity: number } {
  const displacement = current - target;
  const acceleration = -stiffness * displacement - damping * velocity;
  const nextVelocity = velocity + acceleration * dt;
  const nextValue = current + nextVelocity * dt;
  return { value: nextValue, velocity: nextVelocity };
}

export function getWeaverStingerTip(
  weaverX: number,
  weaverY: number,
  weaverZ: number,
  qx: number,
  qy: number,
  qz: number,
  qw: number,
  radius: number,
  scaleMultiplier: number = 1.18
): BABYLON.Vector3 {
  const localTip = new BABYLON.Vector3(0, -radius * scaleMultiplier, 0);
  const q = new BABYLON.Quaternion(qx, qy, qz, qw);
  const worldTipOffset = new BABYLON.Vector3();
  localTip.rotateByQuaternionToRef(q, worldTipOffset);
  return new BABYLON.Vector3(
    weaverX + worldTipOffset.x,
    weaverY + worldTipOffset.y,
    weaverZ + worldTipOffset.z
  );
}

export function configurePBRTextures(
  material: BABYLON.PBRMaterial,
  textures: {
    albedo: BABYLON.BaseTexture;
    normal: BABYLON.BaseTexture;
    orm: BABYLON.BaseTexture;
  }
): void {
  material.albedoTexture = textures.albedo;
  material.bumpTexture = textures.normal;
  material.metallicTexture = textures.orm;
  material.useAmbientOcclusionFromMetallicTextureRed = true;
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = true;
  material.useRoughnessFromMetallicTextureAlpha = false;
}

export class ColorCache {
  private static cache = new Map<string, BABYLON.Color3>();

  public static getColor(hex: string): BABYLON.Color3 {
    let color = this.cache.get(hex);
    if (!color) {
      color = BABYLON.Color3.FromHexString(hex);
      this.cache.set(hex, color);
    }
    return color;
  }

  public static clear(): void {
    this.cache.clear();
  }
}
