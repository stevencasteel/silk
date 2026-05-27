import * as BABYLON from "@babylonjs/core";

export function decoratePlayerSilkVisual(
  scene: BABYLON.Scene,
  pMesh: BABYLON.Mesh,
  height: number,
  radius: number
): void {
  pMesh.isVisible = false;
  pMesh.getChildMeshes().forEach((child) => child.dispose());

  // Cast through unknown to bypass IShadowGenerator interface limitations safely
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
  innerMat.albedoColor = new BABYLON.Color3(0.1, 0.08, 0.12);
  innerMat.roughness = 0.8;
  innerMat.metallic = 0.2;
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

  const silkMat = new BABYLON.PBRMaterial("playerSilkMat", scene);
  silkMat.albedoColor = new BABYLON.Color3(0.93, 0.95, 0.96);
  silkMat.roughness = 0.9;
  silkMat.metallic = 0.0;
  silkMat.sheen.isEnabled = true;
  silkMat.sheen.intensity = 0.8;
  silkMat.sheen.roughness = 0.5;
  silkMat.sheen.color = new BABYLON.Color3(0.98, 0.96, 0.9);
  silkMat.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.05);
  cocoonShell.material = silkMat;
  cocoonShell.parent = pMesh;

  const bandCount = 7;
  const bandMat = new BABYLON.PBRMaterial("playerBandMat", scene);
  bandMat.albedoColor = new BABYLON.Color3(0.85, 0.88, 0.9);
  bandMat.roughness = 0.95;
  bandMat.metallic = 0.0;
  bandMat.sheen.isEnabled = true;
  bandMat.sheen.intensity = 0.6;

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
