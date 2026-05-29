import { applyProceduralTextures, removeMeshFromShadows } from "../../core/utils/EngineUtils";
import { ARENA_CONFIG, VISUAL_JUICE_CONFIG } from "../../core/engine/ArenaConfig";
import * as BABYLON from "@babylonjs/core";
import { ProceduralTextureGenerator } from "../scene/ProceduralTextureGenerator";

export function createPlayerVisualMesh(
  scene: BABYLON.Scene,
  height: number,
  radius: number,
  subdivisions: number
): BABYLON.Mesh {
  const pMesh = BABYLON.MeshBuilder.CreateCapsule(
    "playerVisual",
    {
      height,
      radius,
      subdivisions
    },
    scene
  );

  const pc = ARENA_CONFIG.ENTITY_COLORS.PLAYER_ALBEDO;
  const pMat = new BABYLON.PBRMaterial("playerMat", scene);
  pMat.albedoColor = new BABYLON.Color3(pc.r, pc.g, pc.b);
  pMat.metallic = VISUAL_JUICE_CONFIG.MATERIALS.PLAYER.METALLIC;
  pMat.roughness = VISUAL_JUICE_CONFIG.MATERIALS.PLAYER.ROUGHNESS;
  pMat.sheen.isEnabled = true;
  pMat.sheen.intensity = VISUAL_JUICE_CONFIG.MATERIALS.PLAYER.SHEEN_INTENSITY;
  pMat.sheen.roughness = VISUAL_JUICE_CONFIG.MATERIALS.PLAYER.SHEEN_ROUGHNESS;
  const psc = ARENA_CONFIG.ENTITY_COLORS.PLAYER_SHEEN;
  pMat.sheen.color = new BABYLON.Color3(psc.r, psc.g, psc.b);
  pMesh.material = pMat;

  decoratePlayerSilkVisual(scene, pMesh, height, radius);
  return pMesh;
}

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

  removeMeshFromShadows(pMesh, scene);

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

  applyProceduralTextures(textureGen, "silkFiber", scene, silkMat, {
    resolution: 512,
    noiseScale: 40.0,
    bumpStrength: 3.2,
    baseColor: new BABYLON.Color3(0.95, 0.95, 1.0),
    roughnessMin: 0.05,
    roughnessMax: 0.12,
    metallic: 0.92
  });

  silkMat.sheen.isEnabled = true;
  silkMat.sheen.intensity = 0.95;
  silkMat.sheen.roughness = 0.05;
  silkMat.sheen.color = new BABYLON.Color3(1.0, 1.0, 1.0);
  silkMat.emissiveColor = new BABYLON.Color3(0.1, 0.0, 0.2);
  silkMat.enableSpecularAntiAliasing = true;
  silkMat.forceIrradianceInFragment = true;

  cocoonShell.material = silkMat;
  cocoonShell.parent = pMesh;

  const bandMat = new BABYLON.PBRMaterial("playerBandMat", scene);
  bandMat.metallic = 0.95;
  bandMat.roughness = 0.06;
  bandMat.albedoColor = new BABYLON.Color3(1.0, 1.0, 1.0);

  applyProceduralTextures(textureGen, "silkBand", scene, bandMat, {
    resolution: 256,
    noiseScale: 30.0,
    bumpStrength: 2.8,
    baseColor: new BABYLON.Color3(1.0, 1.0, 1.0),
    roughnessMin: 0.04,
    roughnessMax: 0.1,
    metallic: 0.95
  });

  bandMat.sheen.isEnabled = true;
  bandMat.sheen.intensity = 0.85;
  bandMat.enableSpecularAntiAliasing = true;
  bandMat.forceIrradianceInFragment = true;

  const spiralCount = 14;
  for (let i = 0; i < spiralCount; i++) {
    const t = i / (spiralCount - 1);
    const bandY = (t - 0.5) * height * 0.8;
    const bandRadius = radius * (0.95 + Math.sin(t * Math.PI) * 0.12);

    const band = BABYLON.MeshBuilder.CreateTorus(
      `player_spiral_band_${i}`,
      {
        diameter: bandRadius * 2.0,
        thickness: radius * (0.08 + Math.random() * 0.12),
        tessellation: 12
      },
      scene
    );
    band.position.set(0, bandY, 0);
    band.rotation.x = 0.4 + Math.sin(i * 1.9) * 0.35;
    band.rotation.y = i * (Math.PI / 4) + Math.cos(i * 1.1) * 0.2;
    band.rotation.z = 0.2 + Math.sin(i * 2.7) * 0.25;
    band.material = bandMat;
    band.parent = pMesh;
  }

  const crossCount = 10;
  for (let i = 0; i < crossCount; i++) {
    const t = i / (crossCount - 1);
    const bandY = (t - 0.5) * height * 0.75;
    const bandRadius = radius * (1.0 + Math.sin(t * Math.PI) * 0.08);

    const band = BABYLON.MeshBuilder.CreateTorus(
      `player_cross_band_${i}`,
      {
        diameter: bandRadius * 1.95,
        thickness: radius * (0.06 + Math.random() * 0.08),
        tessellation: 12
      },
      scene
    );
    band.position.set(0, bandY, 0);
    band.rotation.x = -0.4 - Math.cos(i * 2.1) * 0.35;
    band.rotation.y = -i * (Math.PI / 3) + Math.sin(i * 1.4) * 0.2;
    band.rotation.z = -0.2 - Math.cos(i * 1.8) * 0.25;
    band.material = bandMat;
    band.parent = pMesh;
  }

  const knotCount = 6;
  for (let i = 0; i < knotCount; i++) {
    const t = i / (knotCount - 1);
    const bandY = (t - 0.5) * height * 0.65;
    const bandRadius = radius * (1.02 + Math.sin(t * Math.PI) * 0.05);

    const band = BABYLON.MeshBuilder.CreateTorus(
      `player_knot_band_${i}`,
      {
        diameter: bandRadius * 2.05,
        thickness: radius * (0.14 + Math.random() * 0.06),
        tessellation: 10
      },
      scene
    );
    band.position.set(0, bandY, 0);
    band.rotation.x = 0.05 + Math.sin(i * 3.7) * 0.05;
    band.rotation.y = Math.cos(i * 2.8) * 0.15;
    band.rotation.z = Math.sin(i * 1.5) * 0.05;
    band.material = bandMat;
    band.parent = pMesh;
  }

  pMesh.getChildMeshes().forEach((mesh) => {
    mesh.receiveShadows = true;
  });
}
