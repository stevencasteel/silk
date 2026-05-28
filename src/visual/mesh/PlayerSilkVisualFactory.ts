import * as BABYLON from "@babylonjs/core";
import { ProceduralTextureGenerator } from "../scene/ProceduralTextureGenerator";

export function decoratePlayerSilkVisual(
  scene: BABYLON.Scene,
  pMesh: BABYLON.Mesh,
  height: number,
  radius: number
): void {
  pMesh.isVisible = false;
  
  const childMeshes = pMesh.getChildMeshes();
  for (let i = 0; i < childMeshes.length; i++) {
    childMeshes[i].dispose();
  }

  scene.lights.forEach((light) => {
    const shadowGen = light.getShadowGenerator();
    if (shadowGen) {
      const concreteGen = shadowGen as unknown as { removeShadowCaster?: (mesh: BABYLON.AbstractMesh) => void };
      if (concreteGen && typeof concreteGen.removeShadowCaster === "function") {
        concreteGen.removeShadowCaster(pMesh);
      }
    }
  });

  const innerBody = BABYLON.MeshBuilder.CreateCapsule(
    "player_inner_body",
    {
      height: height * 0.75,
      radius: radius * 0.65,
      subdivisions: 3
    },
    scene
  );
  innerBody.position.set(0, 0, 0);
  const innerMat = new BABYLON.PBRMaterial("playerInnerMat", scene);
  innerMat.albedoColor = new BABYLON.Color3(0.04, 0.01, 0.08); 
  innerMat.roughness = 0.95;
  innerMat.metallic = 0.05;
  innerBody.material = innerMat;
  innerBody.parent = pMesh;

  const cocoonShell = BABYLON.MeshBuilder.CreateCapsule(
    "player_cocoon_shell",
    {
      height: height * 0.95,
      radius: radius * 0.95,
      subdivisions: 3
    },
    scene
  );
  cocoonShell.position.set(0, 0, 0);

  const textureGen = new ProceduralTextureGenerator();

  const silkMat = new BABYLON.PBRMaterial("playerSilkMat", scene);
  silkMat.metallic = 0.92; 
  silkMat.roughness = 0.08;
  silkMat.albedoColor = new BABYLON.Color3(0.95, 0.95, 1.0); 

  textureGen.generatePBRTextures("silkFiber", scene, {
    resolution: 512,
    noiseScale: 40.0,
    bumpStrength: 3.2,
    baseColor: new BABYLON.Color3(0.95, 0.95, 1.0),
    roughnessMin: 0.05,
    roughnessMax: 0.12,
    metallic: 0.92
  }).then((silkTexs) => {
    silkMat.albedoTexture = silkTexs.albedo;
    silkMat.bumpTexture = silkTexs.normal;
    silkMat.metallicTexture = silkTexs.orm;
    silkMat.useAmbientOcclusionFromMetallicTextureRed = true;
    silkMat.useRoughnessFromMetallicTextureGreen = true;
    silkMat.useMetallnessFromMetallicTextureBlue = true;
    silkMat.useRoughnessFromMetallicTextureAlpha = false;
  });

  silkMat.sheen.isEnabled = true;
  silkMat.sheen.intensity = 0.95;
  silkMat.sheen.roughness = 0.05;
  silkMat.sheen.color = new BABYLON.Color3(1.0, 1.0, 1.0); // Neutral white sheen reflection
  silkMat.emissiveColor = new BABYLON.Color3(0.1, 0.0, 0.2);
  silkMat.enableSpecularAntiAliasing = true;
  silkMat.forceIrradianceInFragment = true;

  cocoonShell.material = silkMat;
  cocoonShell.parent = pMesh;

  const bandCount = 7;
  const bandMat = new BABYLON.PBRMaterial("playerBandMat", scene);
  bandMat.metallic = 0.95;
  bandMat.roughness = 0.06;
  bandMat.albedoColor = new BABYLON.Color3(1.0, 1.0, 1.0); 

  textureGen.generatePBRTextures("silkBand", scene, {
    resolution: 256,
    noiseScale: 30.0,
    bumpStrength: 2.8,
    baseColor: new BABYLON.Color3(1.0, 1.0, 1.0),
    roughnessMin: 0.04,
    roughnessMax: 0.1,
    metallic: 0.95
  }).then((bandTexs) => {
    bandMat.albedoTexture = bandTexs.albedo;
    bandMat.bumpTexture = bandTexs.normal;
    bandMat.metallicTexture = bandTexs.orm;
    bandMat.useAmbientOcclusionFromMetallicTextureRed = true;
    bandMat.useRoughnessFromMetallicTextureGreen = true;
    bandMat.useMetallnessFromMetallicTextureBlue = true;
    bandMat.useRoughnessFromMetallicTextureAlpha = false;
  });

  bandMat.sheen.isEnabled = true;
  bandMat.sheen.intensity = 0.85;
  bandMat.enableSpecularAntiAliasing = true;
  bandMat.forceIrradianceInFragment = true;

  for (let i = 0; i < bandCount; i++) {
    const t = i / (bandCount - 1);
    const bandY = (t - 0.5) * height * 0.75;
    const bandRadius = radius * (1.02 + Math.sin(t * Math.PI) * 0.06);

    const band = BABYLON.MeshBuilder.CreateTorus(
      `player_band_${i}`,
      {
        diameter: bandRadius * 2.0,
        thickness: radius * 0.16,
        tessellation: 10
      },
      scene
    );

    band.position.set(0, bandY, 0);
    band.rotation.x = 0.15 + Math.sin(i * 1.7) * 0.15;
    band.rotation.y = Math.cos(i * 2.3) * 0.25;
    band.rotation.z = Math.sin(i * 3.1) * 0.15;
    band.material = bandMat;
    band.parent = pMesh;
  }

  const tailPoints = [
    new BABYLON.Vector3(0, height * 0.45, 0),
    new BABYLON.Vector3(0.05, height * 0.55, -radius * 0.2),
    new BABYLON.Vector3(-0.08, height * 0.7, -radius * 0.5)
  ];
  const tail = BABYLON.MeshBuilder.CreateTube(
    "player_thread_tail",
    {
      path: tailPoints,
      radius: 0.035,
      tessellation: 6,
      cap: BABYLON.Mesh.CAP_ALL,
      updatable: false
    },
    scene
  );
  tail.material = silkMat;
  tail.parent = pMesh;

  pMesh.getChildMeshes().forEach((mesh) => {
    mesh.receiveShadows = true;
  });
}
