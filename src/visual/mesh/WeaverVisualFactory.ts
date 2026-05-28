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
    noiseScale: 28.0,
    bumpStrength: 2.2,
    baseColor: new BABYLON.Color3(0.09, 0.07, 0.11),
    roughnessMin: 0.55,
    roughnessMax: 0.85,
    metallic: 0.4
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
    noiseScale: 22.0,
    bumpStrength: 2.4,
    baseColor: new BABYLON.Color3(0.13, 0.09, 0.18),
    roughnessMin: 0.58,
    roughnessMax: 0.88,
    metallic: 0.35
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
    noiseScale: 34.0,
    bumpStrength: 2.0,
    baseColor: new BABYLON.Color3(0.04, 0.03, 0.05),
    roughnessMin: 0.6,
    roughnessMax: 0.9,
    metallic: 0.25
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
    { diameterX: radius * 1.3, diameterY: radius * 1.7, diameterZ: radius * 1.0, segments: 16 },
    scene
  );
  abdomen.position.set(0, -radius * 0.35, radius * 0.1);
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
    { diameterX: radius * 1.0, diameterY: radius * 0.9, diameterZ: radius * 0.7 },
    scene
  );
  cephalothorax.position.set(0, radius * 0.12, -radius * 0.05);
  cephalothorax.material = carapaceMat;
  cephalothorax.parent = wMesh;

  const spinneretMat = new BABYLON.PBRMaterial("weaverSpinneretMat", scene);
  spinneretMat.albedoColor = new BABYLON.Color3(0.05, 0.04, 0.06);
  spinneretMat.metallic = 0.2;
  spinneretMat.roughness = 0.8;

  for (let i = 0; i < 2; i++) {
    const sideSign = i === 0 ? -1 : 1;
    const spinneret = BABYLON.MeshBuilder.CreateCylinder(
      `weaver_spinneret_${i}`,
      {
        height: radius * 0.2,
        diameterTop: radius * 0.02,
        diameterBottom: radius * 0.07,
        tessellation: 6
      },
      scene
    );
    spinneret.position.set(sideSign * radius * 0.04, -radius * 0.85, 0.0);
    spinneret.rotation.x = Math.PI * 0.25;
    spinneret.rotation.z = -sideSign * Math.PI * 0.02;
    spinneret.material = spinneretMat;
    spinneret.parent = abdomen;
  }

  const head = BABYLON.MeshBuilder.CreateSphere(
    "weaver_head",
    { diameterX: radius * 0.9, diameterY: radius * 0.6, diameterZ: radius * 0.8 },
    scene
  );
  head.position.set(0, radius * 0.4, -radius * 0.1);
  head.material = carapaceMat;
  head.parent = wMesh;

  const eyeOffsets = [
    { x: -0.18, y: 0.05, z: -0.35 },
    { x: 0.18, y: 0.05, z: -0.35 },
    { x: -0.08, y: 0.12, z: -0.40 },
    { x: 0.08, y: 0.12, z: -0.40 },
    { x: -0.25, y: 0.08, z: -0.32 },
    { x: 0.25, y: 0.08, z: -0.32 }
  ];

  const a = radius * 0.45;
  const b = radius * 0.3;
  const c = radius * 0.4;
  const eyeRadius = radius * 0.06;

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
    { hipX: 0.35, hipY: 0.36, kneeX: 1.05, kneeY: 1.10, footX: 1.60, footY: -0.10, coxaWidth: 0.15, tibiaWidth: 0.07 },
    { hipX: 0.48, hipY: 0.14, kneeX: 1.25, kneeY: 0.80, footX: 1.80, footY: -0.40, coxaWidth: 0.16, tibiaWidth: 0.075 },
    { hipX: 0.48, hipY: -0.12, kneeX: 1.25, kneeY: 0.50, footX: 1.80, footY: -0.80, coxaWidth: 0.155, tibiaWidth: 0.07 },
    { hipX: 0.35, hipY: -0.34, kneeX: 1.05, kneeY: 0.20, footX: 1.60, footY: -1.20, coxaWidth: 0.14, tibiaWidth: 0.065 }
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
      legRoot.position.set(hipX, hipY, radius * 0.02);
      
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
      coxa.rotation.y = sideSign * -0.45;
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
      tibia.rotation.y = sideSign * 0.9;
      tibia.parent = coxa;

      const foot = createFoot(scene, `foot_${sideSign}_${l}`, radius, legMat);
      foot.position.set(0, tibiaLength, 0);
      foot.parent = tibia;

      legRoot.metadata = {
        sideSign,
        index: l,
        baseRootZ: 0
      };
      coxa.metadata = {
        baseRotationZ: coxa.rotation.z
      };
      tibia.metadata = {
        baseRotationZ: tibia.rotation.z
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
