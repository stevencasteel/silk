import { applyProceduralTextures, removeMeshFromShadows } from "../../core/utils/EngineUtils";
import { ARENA_CONFIG, VISUAL_JUICE_CONFIG } from "../../core/engine/ArenaConfig";
import * as BABYLON from "@babylonjs/core";
import { RasterShearPlugin } from "../lighting/RasterShearPlugin";
import { AbdomenGradientPlugin } from "../lighting/AbdomenGradientPlugin";
import { ProceduralTextureGenerator } from "../scene/ProceduralTextureGenerator";

interface CustomPBRMaterial extends BABYLON.PBRMaterial {
  _shearPlugin?: RasterShearPlugin;
}

interface LegPose {
  hipX: number;
  hipY: number;
  kneeX: number;
  kneeY: number;
  footX: number;
  footY: number;
  coxaWidth: number;
  tibiaWidth: number;
}

function angleFromLocalY(dx: number, dy: number): number {
  return Math.atan2(-dx, dy);
}

function createLegSegment(
  scene: BABYLON.Scene,
  name: string,
  length: number,
  diameterTop: number,
  diameterBottom: number,
  material: BABYLON.Material
): BABYLON.Mesh {
  const segment = BABYLON.MeshBuilder.CreateCylinder(
    name,
    {
      height: length,
      diameterTop,
      diameterBottom,
      tessellation: 7
    },
    scene
  );
  segment.bakeTransformIntoVertices(BABYLON.Matrix.Translation(0, length / 2, 0));
  segment.material = material;
  return segment;
}

function createFoot(
  scene: BABYLON.Scene,
  name: string,
  radius: number,
  material: BABYLON.Material
): BABYLON.Mesh {
  const foot = BABYLON.MeshBuilder.CreateSphere(
    name,
    {
      diameterX: radius * 0.1,
      diameterY: radius * 0.28,
      diameterZ: radius * 0.1
    },
    scene
  );
  foot.scaling.set(1.0, 1.0, 1.0);
  foot.material = material;
  return foot;
}

function createWeaverMaterial(
  name: string,
  scene: BABYLON.Scene,
  color: BABYLON.Color3,
  metallic: number,
  roughness: number,
  enableClearCoat: boolean = false
): CustomPBRMaterial {
  const mat = new BABYLON.PBRMaterial(name, scene) as CustomPBRMaterial;
  mat.albedoColor = color;
  mat.metallic = metallic;
  mat.roughness = roughness;

  if (enableClearCoat) {
    mat.clearCoat.isEnabled = true;
    mat.clearCoat.intensity = 0.95;
    mat.clearCoat.roughness = 0.02;
  }

  mat.enableSpecularAntiAliasing = true;
  mat.forceIrradianceInFragment = true;

  const shearPlugin = new RasterShearPlugin(mat);
  mat._shearPlugin = shearPlugin;

  return mat;
}

export function createWeaverVisualMesh(
  scene: BABYLON.Scene,
  radius: number,
  subdivisions: number,
  registerShadowCaster?: (mesh: BABYLON.AbstractMesh) => void
): BABYLON.Mesh {
  const wMesh = BABYLON.MeshBuilder.CreateIcoSphere(
    "weaverVisual",
    { radius, subdivisions },
    scene
  );

  if (radius > 0) {
    const positions = wMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    if (positions) {
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];
        if (y < 0) {
          const r_sphere = Math.sqrt(Math.max(0, radius * radius - y * y));
          if (r_sphere > 0.05) {
                const r_cone = radius * (1.0 + y / radius);
                const scaleFactor = Math.min(r_cone / r_sphere, 4.0);
            positions[i] = x * scaleFactor;
            positions[i + 2] = z * scaleFactor;
          } else {
            positions[i] = 0;
            positions[i + 2] = 0;
          }
        }
      }
      wMesh.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
      const normals: number[] = [];
      const indices = wMesh.getIndices();
      if (indices) {
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        wMesh.setVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
      }
    }
  }

  const wc = ARENA_CONFIG.ENTITY_COLORS.WEAVER_ALBEDO;
  const wMat = new BABYLON.PBRMaterial("weaverMat", scene);
  wMat.albedoColor = new BABYLON.Color3(wc.r, wc.g, wc.b);
  wMat.metallic = VISUAL_JUICE_CONFIG.MATERIALS.WEAVER.METALLIC;
  wMat.roughness = VISUAL_JUICE_CONFIG.MATERIALS.WEAVER.ROUGHNESS;
  wMat.clearCoat.isEnabled = true;
  wMat.clearCoat.intensity = VISUAL_JUICE_CONFIG.MATERIALS.WEAVER.CLEAR_COAT_INTENSITY;
  wMat.clearCoat.roughness = VISUAL_JUICE_CONFIG.MATERIALS.WEAVER.CLEAR_COAT_ROUGHNESS;
  wMesh.material = wMat;
  const shearPlugin = new RasterShearPlugin(wMat);
  (wMat as BABYLON.PBRMaterial & { _shearPlugin?: RasterShearPlugin })._shearPlugin = shearPlugin;

  decorateWeaverVisual(scene, wMesh, radius, registerShadowCaster);
  return wMesh;
}

export function decorateWeaverVisual(
  scene: BABYLON.Scene,
  wMesh: BABYLON.Mesh,
  radius: number,
  registerShadowCaster?: (mesh: BABYLON.AbstractMesh) => void
): void {
  wMesh.isVisible = false;

  const childMeshes = wMesh.getChildMeshes();
  for (let i = 0; i < childMeshes.length; i++) {
    childMeshes[i].dispose();
  }

  removeMeshFromShadows(wMesh, scene);

  const textureGen = new ProceduralTextureGenerator();

  const imperialPurple = new BABYLON.Color3(
    ARENA_CONFIG.ENTITY_COLORS.WEAVER_ALBEDO.r,
    ARENA_CONFIG.ENTITY_COLORS.WEAVER_ALBEDO.g,
    ARENA_CONFIG.ENTITY_COLORS.WEAVER_ALBEDO.b
  );

  const carapaceMat = createWeaverMaterial("carapaceMat", scene, imperialPurple, 0.98, 0.06, true);

  applyProceduralTextures(textureGen, "carapaceShell", scene, carapaceMat, {
    resolution: 512,
    noiseScale: 18.0,
    bumpStrength: 1.65,
    baseColor: imperialPurple,
    roughnessMin: 0.05,
    roughnessMax: 0.15,
    metallic: 0.98,
    ridgeStrength: 0.13,
    ridgeScale: 0.54,
    ridgeDirectionX: 0.25,
    ridgeDirectionY: 1.0,
    colorVariation: 0.16
  });

  const upperPurple = new BABYLON.Color3(
    ARENA_CONFIG.ENTITY_COLORS.WEAVER_ALBEDO.r * 1.6,
    ARENA_CONFIG.ENTITY_COLORS.WEAVER_ALBEDO.g,
    ARENA_CONFIG.ENTITY_COLORS.WEAVER_ALBEDO.b * 1.6
  );

  const shellMat = createWeaverMaterial("carapaceUpperMat", scene, upperPurple, 0.95, 0.08, true);
  const abdomenPlugin = new AbdomenGradientPlugin(shellMat);
  (shellMat as BABYLON.PBRMaterial & { _abdomenPlugin?: AbdomenGradientPlugin })._abdomenPlugin = abdomenPlugin;

  applyProceduralTextures(textureGen, "carapaceUpper", scene, shellMat, {
    resolution: 512,
    noiseScale: 16.0,
    bumpStrength: 1.85,
    baseColor: upperPurple,
    roughnessMin: 0.05,
    roughnessMax: 0.15,
    metallic: 0.95,
    ridgeStrength: 0.18,
    ridgeScale: 0.48,
    ridgeDirectionX: 0.12,
    ridgeDirectionY: 1.0,
    colorVariation: 0.18
  });

  const legMat = createWeaverMaterial(
    "legMat",
    scene,
    new BABYLON.Color3(0.06, 0.0, 0.1),
    0.98,
    0.05,
    false
  );

  applyProceduralTextures(textureGen, "legScratches", scene, legMat, {
    resolution: 256,
    noiseScale: 26.0,
    bumpStrength: 1.55,
    baseColor: new BABYLON.Color3(0.06, 0.0, 0.1),
    roughnessMin: 0.03,
    roughnessMax: 0.12,
    metallic: 0.98,
    ridgeStrength: 0.22,
    ridgeScale: 1.15,
    ridgeDirectionX: 0.08,
    ridgeDirectionY: 1.0,
    colorVariation: 0.12
  });

  const footMat = createWeaverMaterial(
    "footMat",
    scene,
    new BABYLON.Color3(0.12, 0.0, 0.22),
    0.95,
    0.08,
    false
  );

  const eyeMat = new BABYLON.StandardMaterial("weaverEyeMat", scene);
  eyeMat.emissiveColor = new BABYLON.Color3(1.0, 0.0, 0.5);
  eyeMat.disableLighting = true;

  const abdomen = BABYLON.MeshBuilder.CreateSphere(
    "weaver_abdomen",
    { diameterX: radius * 1.38, diameterY: radius * 1.55, diameterZ: radius * 0.64, segments: 24 },
    scene
  );
  abdomen.position.set(0, -radius * 0.42, -radius * 0.035);
  abdomen.material = shellMat;
  abdomen.parent = wMesh;

  const positions = abdomen.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  const halfY = radius * 0.75;
  if (positions) {
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];

      if (y < 0) {
        const normY = y / halfY;
        const r_sphere = Math.sqrt(Math.max(0, 1.0 - normY * normY));
        if (r_sphere > 0.05) {
              const r_cone = 1.0 + normY;
              const scaleFactor = Math.min(r_cone / r_sphere, 4.0);
          positions[i] = x * scaleFactor;
          positions[i + 2] = z * scaleFactor;
        } else {
          positions[i] = 0;
          positions[i + 2] = 0;
        }
      }
    }
    abdomen.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    const normals: number[] = [];
    const indices = abdomen.getIndices();
    if (indices) {
      BABYLON.VertexData.ComputeNormals(positions, indices, normals);
      abdomen.setVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
    }
  }

  const cephalothorax = BABYLON.MeshBuilder.CreateSphere(
    "weaver_cephalothorax",
    { diameterX: radius * 1.06, diameterY: radius * 0.84, diameterZ: radius * 0.5, segments: 20 },
    scene
  );
  cephalothorax.position.set(0, radius * 0.08, -radius * 0.055);
  cephalothorax.material = carapaceMat;
  cephalothorax.parent = wMesh;

  const head = BABYLON.MeshBuilder.CreateSphere(
    "weaver_head",
    { diameterX: radius * 0.76, diameterY: radius * 0.48, diameterZ: radius * 0.45, segments: 18 },
    scene
  );
  head.position.set(0, radius * 0.42, -radius * 0.08);
  head.material = carapaceMat;
  head.parent = wMesh;

  const eyeOffsets = [
    { x: -0.15, y: 0.02, z: -0.36 },
    { x: 0.15, y: 0.02, z: -0.36 },
    { x: -0.06, y: 0.11, z: -0.4 },
    { x: 0.06, y: 0.11, z: -0.4 },
    { x: -0.24, y: 0.07, z: -0.31 },
    { x: 0.24, y: 0.07, z: -0.31 }
  ];

  const a = radius * 0.38;
  const b = radius * 0.24;
  const c = radius * 0.225;
  const eyeRadius = radius * 0.048;

  eyeOffsets.forEach((offset, idx) => {
    const eye = BABYLON.MeshBuilder.CreateSphere(
      `weaver_eye_${idx}`,
      { diameter: eyeRadius * 2.0 },
      scene
    );

    const ox = offset.x * radius;
    const oy = offset.y * radius;
    const oz = offset.z * radius;

    const sum = (ox * ox) / (a * a) + (oy * oy) / (b * b) + (oz * oz) / (c * c);
    const k = 1.0 / Math.sqrt(sum || 1.0);

    const sx = ox * k;
    const sy = oy * k;
    const sz = oz * k;

    const nx = sx / (a * a);
    const ny = sy / (b * b);
    const nz = sz / (c * c);
    const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;
    const dx = nx / nLen;
    const dy = ny / nLen;
    const dz = nz / nLen;

    const recessAmt = eyeRadius * 0.5;
    const px = sx - dx * recessAmt;
    const py = sy - dy * recessAmt;
    const pz = sz - dz * recessAmt;

    eye.position.set(px, py, pz);
    eye.material = eyeMat;
    eye.parent = head;
  });

  const legPoses: LegPose[] = [
    {
      hipX: 0.38,
      hipY: 0.32,
      kneeX: 0.96,
      kneeY: 0.74,
      footX: 1.7,
      footY: 1.02,
      coxaWidth: 0.14,
      tibiaWidth: 0.058
    },
    {
      hipX: 0.5,
      hipY: 0.1,
      kneeX: 1.2,
      kneeY: 0.24,
      footX: 1.95,
      footY: 0.26,
      coxaWidth: 0.15,
      tibiaWidth: 0.064
    },
    {
      hipX: 0.5,
      hipY: -0.12,
      kneeX: 1.2,
      kneeY: -0.32,
      footX: 1.92,
      footY: -0.52,
      coxaWidth: 0.145,
      tibiaWidth: 0.06
    },
    {
      hipX: 0.36,
      hipY: -0.34,
      kneeX: 0.96,
      kneeY: -0.74,
      footX: 1.68,
      footY: -1.08,
      coxaWidth: 0.13,
      tibiaWidth: 0.054
    }
  ];

  for (let side = 0; side < 2; side++) {
    const sideSign = side === 0 ? -1 : 1;
    for (let l = 0; l < 4; l++) {
      const pose = legPoses[l];
      const hipX = sideSign * pose.hipX * radius;
      const hipY = pose.hipY * radius;
      const kneeX = sideSign * pose.kneeX * radius;
      const kneeY = pose.kneeY * radius;
      const footX = sideSign * pose.footX * radius;
      const footY = pose.footY * radius;

      const legRoot = new BABYLON.TransformNode(`leg_root_${sideSign}_${l}`, scene);
      legRoot.parent = wMesh;
      legRoot.position.set(hipX, hipY, radius * -0.15);

      const coxaDx = kneeX - hipX;
      const coxaDy = kneeY - hipY;
      const coxaLength = Math.sqrt(coxaDx * coxaDx + coxaDy * coxaDy);

      const coxa = createLegSegment(
        scene,
        `coxa_${sideSign}_${l}`,
        coxaLength,
        pose.coxaWidth * radius,
        pose.coxaWidth * radius * 1.2,
        carapaceMat
      );
      coxa.rotation.z = angleFromLocalY(coxaDx, coxaDy);
      coxa.rotation.x = -0.45;
      coxa.parent = legRoot;

      const tibiaDx = footX - kneeX;
      const tibiaDy = footY - kneeY;
      const tibiaLength = Math.sqrt(tibiaDx * tibiaDx + tibiaDy * tibiaDy);

      const tibia = createLegSegment(
        scene,
        `tibia_${sideSign}_${l}`,
        tibiaLength,
        pose.tibiaWidth * radius,
        pose.tibiaWidth * radius * 1.3,
        legMat
      );
      tibia.position.set(0, coxaLength, 0);
      tibia.rotation.z = angleFromLocalY(tibiaDx, tibiaDy) - coxa.rotation.z;
      tibia.rotation.x = 1.1;
      tibia.parent = coxa;

      const foot = createFoot(scene, `foot_${sideSign}_${l}`, radius, footMat);
      foot.position.set(0, tibiaLength, 0);
      foot.rotation.set(0, 0, sideSign * 0.22);
      foot.parent = tibia;

      legRoot.metadata = {
        sideSign,
        index: l,
        baseRootZ: 0,
        basePositionZ: legRoot.position.z,
        coxaLength,
        tibiaLength,
        baseFootLocal: new BABYLON.Vector3(footX - hipX, footY - hipY, 0)
      };
      coxa.metadata = {
        baseRotationZ: coxa.rotation.z,
        baseRotationX: coxa.rotation.x
      };
      tibia.metadata = {
        baseRotationZ: tibia.rotation.z,
        baseRotationX: tibia.rotation.x
      };
    }
  }

  wMesh.getChildMeshes().forEach((mesh) => {
    if (
      mesh.name.includes("weaver_eye") ||
      mesh.name.includes("spinneret_glow") ||
      mesh.name.includes("foot_")
    ) {
      mesh.receiveShadows = false;
    } else {
      mesh.receiveShadows = true;
      if (registerShadowCaster) {
        registerShadowCaster(mesh);
      }
    }
  });
}
