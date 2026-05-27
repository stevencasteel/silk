import * as BABYLON from "@babylonjs/core";
import { RasterShearPlugin } from "../lighting/RasterShearPlugin";

interface CustomPBRMaterial extends BABYLON.PBRMaterial {
  _shearPlugin?: RasterShearPlugin;
}

export function decorateWeaverVisual(
  scene: BABYLON.Scene,
  wMesh: BABYLON.Mesh,
  radius: number,
  registerShadowCaster?: (mesh: BABYLON.AbstractMesh) => void
): void {
  wMesh.isVisible = false;
  wMesh.getChildMeshes().forEach((child) => child.dispose());

  // Cast through unknown to bypass IShadowGenerator interface limitations safely
  scene.lights.forEach((light) => {
    const shadowGen = light.getShadowGenerator();
    if (shadowGen) {
      const concreteGen = shadowGen as unknown as { removeShadowCaster?: (mesh: BABYLON.AbstractMesh) => void };
      if (concreteGen && typeof concreteGen.removeShadowCaster === "function") {
        concreteGen.removeShadowCaster(wMesh);
      }
    }
  });

  const carapaceMat = new BABYLON.PBRMaterial("carapaceMat", scene) as CustomPBRMaterial;
  carapaceMat.albedoColor = new BABYLON.Color3(0.09, 0.07, 0.11);
  carapaceMat.metallic = 0.8;
  carapaceMat.roughness = 0.15;
  carapaceMat.clearCoat.isEnabled = true;
  carapaceMat.clearCoat.intensity = 0.6;
  carapaceMat.clearCoat.roughness = 0.1;
  const shearPluginCarapace = new RasterShearPlugin(carapaceMat);
  carapaceMat._shearPlugin = shearPluginCarapace;

  const shellMat = new BABYLON.PBRMaterial("carapaceUpperMat", scene) as CustomPBRMaterial;
  shellMat.albedoColor = new BABYLON.Color3(0.13, 0.09, 0.18);
  shellMat.metallic = 0.8;
  shellMat.roughness = 0.2;
  shellMat.clearCoat.isEnabled = true;
  shellMat.clearCoat.intensity = 0.6;
  shellMat.clearCoat.roughness = 0.1;
  const shearPluginShell = new RasterShearPlugin(shellMat);
  shellMat._shearPlugin = shearPluginShell;

  const legMat = new BABYLON.PBRMaterial("legMat", scene) as CustomPBRMaterial;
  legMat.albedoColor = new BABYLON.Color3(0.04, 0.03, 0.05);
  legMat.metallic = 0.6;
  legMat.roughness = 0.3;
  const shearPluginLeg = new RasterShearPlugin(legMat);
  legMat._shearPlugin = shearPluginLeg;

  const eyeMat = new BABYLON.StandardMaterial("weaverEyeMat", scene);
  eyeMat.emissiveColor = new BABYLON.Color3(1.0, 0.18, 0.31);
  eyeMat.disableLighting = true;

  const abdomen = BABYLON.MeshBuilder.CreateSphere(
    "weaver_abdomen",
    { diameterX: radius * 1.1, diameterY: radius * 1.5, diameterZ: radius * 1.1, segments: 16 },
    scene
  );
  abdomen.position.set(0, -radius * 0.3, radius * 0.1);
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

  const head = BABYLON.MeshBuilder.CreateSphere(
    "weaver_head",
    { diameterX: radius * 0.9, diameterY: radius * 0.6, diameterZ: radius * 0.8 },
    scene
  );
  head.position.set(0, radius * 0.4, -radius * 0.1);
  head.material = carapaceMat;
  head.parent = wMesh;

  const eyeOffsets = [
    { x: -0.18, y: -0.15, z: -0.32 },
    { x: 0.18, y: -0.15, z: -0.32 },
    { x: -0.08, y: -0.05, z: -0.38 },
    { x: 0.08, y: -0.05, z: -0.38 },
    { x: -0.25, y: -0.05, z: -0.28 },
    { x: 0.25, y: -0.05, z: -0.28 }
  ];
  eyeOffsets.forEach((offset, idx) => {
    const eye = BABYLON.MeshBuilder.CreateSphere(
      `weaver_eye_${idx}`,
      { diameter: radius * 0.12 },
      scene
    );
    eye.position.set(offset.x * radius, offset.y * radius, offset.z * radius);
    eye.material = eyeMat;
    eye.parent = head;
  });

  for (let side = 0; side < 2; side++) {
    const sideSign = side === 0 ? -1 : 1;
    for (let l = 0; l < 4; l++) {
      const legRoot = new BABYLON.TransformNode(`leg_root_${sideSign}_${l}`, scene);
      legRoot.parent = wMesh;

      const angleOffset = (l - 1.5) * 0.45;
      const basePosX = sideSign * radius * 0.45;
      const basePosY = radius * 0.1 + (l - 1.5) * 0.15 * radius;
      const basePosZ = (l - 1.5) * 0.25 * radius;
      legRoot.position.set(basePosX, basePosY, basePosZ);

      const coxaLength = radius * 0.65;
      const coxa = BABYLON.MeshBuilder.CreateCylinder(
        `coxa_${sideSign}_${l}`,
        {
          height: coxaLength,
          diameterTop: radius * 0.14,
          diameterBottom: radius * 0.18,
          tessellation: 6
        },
        scene
      );
      coxa.position.set(sideSign * coxaLength * 0.45, coxaLength * 0.1, -coxaLength * 0.1);
      coxa.rotation.z = sideSign * (Math.PI / 4 + angleOffset * 0.3);
      coxa.rotation.y = angleOffset;
      coxa.material = carapaceMat;
      coxa.parent = legRoot;

      const tibiaLength = radius * 0.9;
      const tibia = BABYLON.MeshBuilder.CreateCylinder(
        `tibia_${sideSign}_${l}`,
        {
          height: tibiaLength,
          diameterTop: radius * 0.04,
          diameterBottom: radius * 0.12,
          tessellation: 6
        },
        scene
      );
      tibia.position.set(sideSign * tibiaLength * 0.35, -tibiaLength * 0.4, 0);
      tibia.rotation.z = -sideSign * (Math.PI / 3);
      tibia.material = legMat;
      tibia.parent = coxa;
    }
  }

  wMesh.getChildMeshes().forEach((mesh) => {
    if (mesh.name.includes("weaver_eye") || mesh.name.includes("spinneret_glow")) {
      mesh.receiveShadows = false;
    } else {
      mesh.receiveShadows = true;
      if (registerShadowCaster) {
        registerShadowCaster(mesh);
      }
    }
  });
}
