import * as BABYLON from "@babylonjs/core";
import { RasterShearPlugin } from "../lighting/RasterShearPlugin";
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
      diameterX: radius * 0.11,
      diameterY: radius * 0.16,
      diameterZ: radius * 0.09
    },
    scene
  );
  foot.scaling.set(1.5, 0.8, 0.5);
  foot.material = material;
  return foot;
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

  scene.lights.forEach((light) => {
    const shadowGen = light.getShadowGenerator();
    if (shadowGen) {
      const concreteGen = shadowGen as unknown as { removeShadowCaster?: (mesh: BABYLON.AbstractMesh) => void };
      if (concreteGen && typeof concreteGen.removeShadowCaster === "function") {
        concreteGen.removeShadowCaster(wMesh);
      }
    }
  });

  const textureGen = new ProceduralTextureGenerator();

  const carapaceMat = new BABYLON.PBRMaterial("carapaceMat", scene) as CustomPBRMaterial;
  carapaceMat.metallic = 0.45;
  carapaceMat.roughness = 0.65;
  carapaceMat.albedoColor = new BABYLON.Color3(0.09, 0.07, 0.11);

  textureGen.generatePBRTextures("carapaceShell", scene, {
    resolution: 512,
    noiseScale: 18.0,
    bumpStrength: 1.65,
    baseColor: new BABYLON.Color3(0.075, 0.055, 0.095),
    roughnessMin: 0.5,
    roughnessMax: 0.82,
    metallic: 0.32,
    ridgeStrength: 0.13,
    ridgeScale: 0.54,
    ridgeDirectionX: 0.25,
    ridgeDirectionY: 1.0,
    colorVariation: 0.16
  }).then((carapaceTexs) => {
    carapaceMat.albedoTexture = carapaceTexs.albedo;
    carapaceMat.bumpTexture = carapaceTexs.normal;
    carapaceMat.metallicTexture = carapaceTexs.orm;
    carapaceMat.useAmbientOcclusionFromMetallicTextureRed = true;
    carapaceMat.useRoughnessFromMetallicTextureGreen = true;
    carapaceMat.useMetallnessFromMetallicTextureBlue = true;
    carapaceMat.useRoughnessFromMetallicTextureAlpha = false;
  });

  carapaceMat.clearCoat.isEnabled = true;
  carapaceMat.clearCoat.intensity = 0.35;
  carapaceMat.clearCoat.roughness = 0.4;
  carapaceMat.enableSpecularAntiAliasing = true;
  carapaceMat.forceIrradianceInFragment = true;

  const shearPluginCarapace = new RasterShearPlugin(carapaceMat);
  carapaceMat._shearPlugin = shearPluginCarapace;

  const shellMat = new BABYLON.PBRMaterial("carapaceUpperMat", scene) as CustomPBRMaterial;
  shellMat.metallic = 0.4;
  shellMat.roughness = 0.7;
  shellMat.albedoColor = new BABYLON.Color3(0.13, 0.09, 0.18);

  textureGen.generatePBRTextures("carapaceUpper", scene, {
    resolution: 512,
    noiseScale: 16.0,
    bumpStrength: 1.85,
    baseColor: new BABYLON.Color3(0.12, 0.075, 0.16),
    roughnessMin: 0.48,
    roughnessMax: 0.8,
    metallic: 0.28,
    ridgeStrength: 0.18,
    ridgeScale: 0.48,
    ridgeDirectionX: 0.12,
    ridgeDirectionY: 1.0,
    colorVariation: 0.18
  }).then((shellTexs) => {
    shellMat.albedoTexture = shellTexs.albedo;
    shellMat.bumpTexture = shellTexs.normal;
    shellMat.metallicTexture = shellTexs.orm;
    shellMat.useAmbientOcclusionFromMetallicTextureRed = true;
    shellMat.useRoughnessFromMetallicTextureGreen = true;
    shellMat.useMetallnessFromMetallicTextureBlue = true;
    shellMat.useRoughnessFromMetallicTextureAlpha = false;
  });

  shellMat.clearCoat.isEnabled = true;
  shellMat.clearCoat.intensity = 0.35;
  shellMat.clearCoat.roughness = 0.45;
  shellMat.enableSpecularAntiAliasing = true;
  shellMat.forceIrradianceInFragment = true;

  const shearPluginShell = new RasterShearPlugin(shellMat);
  shellMat._shearPlugin = shearPluginShell;

  const legMat = new BABYLON.PBRMaterial("legMat", scene) as CustomPBRMaterial;
  legMat.metallic = 0.3;
  legMat.roughness = 0.75;
  legMat.albedoColor = new BABYLON.Color3(0.04, 0.03, 0.05);

  textureGen.generatePBRTextures("legScratches", scene, {
    resolution: 256,
    noiseScale: 26.0,
    bumpStrength: 1.55,
    baseColor: new BABYLON.Color3(0.035, 0.03, 0.047),
    roughnessMin: 0.56,
    roughnessMax: 0.86,
    metallic: 0.2,
    ridgeStrength: 0.22,
    ridgeScale: 1.15,
    ridgeDirectionX: 0.08,
    ridgeDirectionY: 1.0,
    colorVariation: 0.12
  }).then((legTexs) => {
    legMat.albedoTexture = legTexs.albedo;
    legMat.bumpTexture = legTexs.normal;
    legMat.metallicTexture = legTexs.orm;
    legMat.useAmbientOcclusionFromMetallicTextureRed = true;
    legMat.useRoughnessFromMetallicTextureGreen = true;
    legMat.useMetallnessFromMetallicTextureBlue = true;
    legMat.useRoughnessFromMetallicTextureAlpha = false;
  });
  legMat.enableSpecularAntiAliasing = true;
  legMat.forceIrradianceInFragment = true;

  const shearPluginLeg = new RasterShearPlugin(legMat);
  legMat._shearPlugin = shearPluginLeg;

  const eyeMat = new BABYLON.StandardMaterial("weaverEyeMat", scene);
  eyeMat.emissiveColor = new BABYLON.Color3(1.0, 0.18, 0.31);
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
        if (r_sphere > 0.001) {
          const r_cone = 1.0 + normY;
          const scaleFactor = r_cone / r_sphere;
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
    { hipX: 0.38, hipY: 0.32, kneeX: 0.96, kneeY: 0.74, footX: 1.7, footY: 1.02, coxaWidth: 0.14, tibiaWidth: 0.058 },
    { hipX: 0.5, hipY: 0.1, kneeX: 1.2, kneeY: 0.24, footX: 1.95, footY: 0.26, coxaWidth: 0.15, tibiaWidth: 0.064 },
    { hipX: 0.5, hipY: -0.12, kneeX: 1.2, kneeY: -0.32, footX: 1.92, footY: -0.52, coxaWidth: 0.145, tibiaWidth: 0.06 },
    { hipX: 0.36, hipY: -0.34, kneeX: 0.96, kneeY: -0.74, footX: 1.68, footY: -1.08, coxaWidth: 0.13, tibiaWidth: 0.054 }
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
      legRoot.position.set(hipX, hipY, radius * 0.035);
      
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
      coxa.rotation.x = -0.34;
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
      tibia.rotation.x = 0.82;
      tibia.parent = coxa;

      const foot = createFoot(scene, `foot_${sideSign}_${l}`, radius, legMat);
      foot.position.set(0, tibiaLength, radius * 0.08);
      foot.rotation.x = -0.24;
      foot.parent = tibia;

      legRoot.metadata = {
        sideSign,
        index: l,
        baseRootZ: 0,
        basePositionZ: legRoot.position.z
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
