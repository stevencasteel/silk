import * as BABYLON from "@babylonjs/core";

export const HASH_PREFIX = String.fromCharCode(35);

export function getDistance2D(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy) || 1.0;
}

export function dispatchUIFeedback(event: "silk-stats-tick" | "silk-play-confirm" | "silk-tension-alarm"): void {
  try {
    window.dispatchEvent(new CustomEvent(event));
  } catch (err) {
    void err;
  }
}

export class SubscriptionTracker {
  private _unsubs: (() => void)[] = [];

  public add(unsub: () => void): void {
    this._unsubs.push(unsub);
  }

  public clear(): void {
    for (let i = 0; i < this._unsubs.length; i++) {
      this._unsubs[i]();
    }
    this._unsubs.length = 0;
  }
}

export interface IProceduralTextureGenerator {
  generatePBRTextures(name: string, scene: BABYLON.Scene, config: unknown): Promise<{
    albedo: BABYLON.DynamicTexture;
    normal: BABYLON.DynamicTexture;
    orm: BABYLON.DynamicTexture;
  }>;
}

export function applyProceduralTextures(
  textureGen: IProceduralTextureGenerator,
  name: string,
  scene: BABYLON.Scene,
  material: BABYLON.PBRMaterial,
  config: unknown,
  customSetup?: (mat: BABYLON.PBRMaterial) => void
): void {
  textureGen.generatePBRTextures(name, scene, config).then((textures) => {
    configurePBRTextures(material, textures);
    if (customSetup) {
      customSetup(material);
    }
  });
}

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

export interface ScaleTransformLike {
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  scaleVelX?: number;
  scaleVelY?: number;
  scaleVelZ?: number;
}

export function solveScaleSpring(
  trans: ScaleTransformLike,
  targetX: number,
  targetY: number,
  targetZ: number,
  dt: number,
  stiffness: number,
  damping: number
): void {
  const sx = trans.scaleX ?? 1.0;
  const sy = trans.scaleY ?? 1.0;
  const sz = trans.scaleZ ?? 1.0;
  const vx = trans.scaleVelX ?? 0.0;
  const vy = trans.scaleVelY ?? 0.0;
  const vz = trans.scaleVelZ ?? 0.0;

  const springX = solveSpringDamper(sx, targetX, vx, dt, stiffness, damping);
  trans.scaleX = springX.value;
  trans.scaleVelX = springX.velocity;

  const springY = solveSpringDamper(sy, targetY, vy, dt, stiffness, damping);
  trans.scaleY = springY.value;
  trans.scaleVelY = springY.velocity;

  const springZ = solveSpringDamper(sz, targetZ, vz, dt, stiffness, damping);
  trans.scaleZ = springZ.value;
  trans.scaleVelZ = springZ.velocity;
}

export function setKinematicVelocity(
  ctx: {
    commands: {
      dispatch: (cmd: { type: string; entityId: number; x: number; y: number; z: number }) => void;
    };
  },
  entityId: number,
  x: number,
  y: number,
  z: number = 0
): void {
  ctx.commands.dispatch({
    type: "SET_KINEMATIC_VELOCITY",
    entityId,
    x,
    y,
    z
  });
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
