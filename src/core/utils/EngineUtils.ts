import * as BABYLON from "@babylonjs/core";

export const HASH_PREFIX = String.fromCharCode(35);

export function getDistance2D(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy) || 1.0;
}

export function dispatchUIFeedback(
  event: "silk-stats-tick" | "silk-play-confirm" | "silk-tension-alarm"
): void {
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

export interface ProceduralTextureConfig {
  resolution: number;
  noiseScale: number;
  bumpStrength: number;
  baseColor: BABYLON.Color3;
  roughnessMin: number;
  roughnessMax: number;
  metallic: number;
  ridgeStrength?: number;
  ridgeScale?: number;
  ridgeDirectionX?: number;
  ridgeDirectionY?: number;
  colorVariation?: number;
}

export interface IProceduralTextureGenerator {
  generatePBRTextures(
    name: string,
    scene: BABYLON.Scene,
    config: ProceduralTextureConfig,
    onProgress?: (percent: number) => void
  ): Promise<{
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
  config: ProceduralTextureConfig,
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

const _stingerLocalTip = new BABYLON.Vector3();
const _stingerQ = new BABYLON.Quaternion();
const _stingerWorldOffset = new BABYLON.Vector3();
const _stingerResult = new BABYLON.Vector3();

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
  _stingerLocalTip.set(0, -radius * scaleMultiplier, 0);
  _stingerQ.set(qx, qy, qz, qw);
  _stingerLocalTip.rotateByQuaternionToRef(_stingerQ, _stingerWorldOffset);
  _stingerResult.set(
    weaverX + _stingerWorldOffset.x,
    weaverY + _stingerWorldOffset.y,
    weaverZ + _stingerWorldOffset.z
  );
  return _stingerResult;
}

const _abdomenLocalTip = new BABYLON.Vector3();
const _abdomenQ = new BABYLON.Quaternion();
const _abdomenWorldOffset = new BABYLON.Vector3();
const _abdomenResult = new BABYLON.Vector3();

export function getWeaverAbdomenTip(
  weaverX: number,
  weaverY: number,
  weaverZ: number,
  qx: number,
  qy: number,
  qz: number,
  qw: number,
  radius: number,
  scaleMultiplier: number = 1.0
): BABYLON.Vector3 {
  _abdomenLocalTip.set(0, -radius * 1.195 * scaleMultiplier, -radius * 0.035 * scaleMultiplier);
  _abdomenQ.set(qx, qy, qz, qw);
  _abdomenLocalTip.rotateByQuaternionToRef(_abdomenQ, _abdomenWorldOffset);
  _abdomenResult.set(
    weaverX + _abdomenWorldOffset.x,
    weaverY + _abdomenWorldOffset.y,
    weaverZ + _abdomenWorldOffset.z
  );
  return _abdomenResult;
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

export function removeMeshFromShadows(mesh: BABYLON.AbstractMesh, scene: BABYLON.Scene): void {
  scene.lights.forEach((light) => {
    const shadowGen = light.getShadowGenerator();
    if (shadowGen) {
      const concreteGen = shadowGen as unknown as {
        removeShadowCaster?: (m: BABYLON.AbstractMesh) => void;
      };
      if (concreteGen && typeof concreteGen.removeShadowCaster === "function") {
        concreteGen.removeShadowCaster(mesh);
      }
    }
  });
}
