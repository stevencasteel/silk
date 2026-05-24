import * as BABYLON from "@babylonjs/core";

export class ArenaGeometry {
  constructor(private scene: BABYLON.Scene) {}

  public generateElevatorShaft(): void {
    const wallMaterial = new BABYLON.PBRMaterial("wallMat", this.scene);
    wallMaterial.albedoColor = new BABYLON.Color3(0.06, 0.06, 0.07);
    wallMaterial.metallic = 0.1;
    wallMaterial.roughness = 0.85;

    const leftWall = BABYLON.MeshBuilder.CreateBox(
      "leftWall",
      { width: 2, height: 140, depth: 4 },
      this.scene
    );
    leftWall.position.set(-16, 14, 0);
    leftWall.material = wallMaterial;
    leftWall.receiveShadows = true;

    const rightWall = BABYLON.MeshBuilder.CreateBox(
      "rightWall",
      { width: 2, height: 140, depth: 4 },
      this.scene
    );
    rightWall.position.set(16, 14, 0);
    rightWall.material = wallMaterial;
    rightWall.receiveShadows = true;

    const tickMat = new BABYLON.PBRMaterial("tickMat", this.scene);
    tickMat.albedoColor = new BABYLON.Color3(0.05, 0.08, 0.12);
    tickMat.metallic = 0.0;
    tickMat.roughness = 0.5;
    tickMat.emissiveColor = new BABYLON.Color3(0.15, 0.4, 0.8);
    tickMat.emissiveIntensity = 1.5;

    const tickCount = 70;
    for (let i = 0; i < tickCount; i++) {
      const leftTick = BABYLON.MeshBuilder.CreateBox(
        `leftTick_${i}`,
        { width: 0.2, height: 0.08, depth: 2.1 },
        this.scene
      );
      leftTick.position.set(-14.9, i * 2.0 - 56.0, 0);
      leftTick.material = tickMat;
      leftTick.metadata = { type: "scrolling_tick", index: i, initialY: i * 2.0 - 56.0 };

      const rightTick = BABYLON.MeshBuilder.CreateBox(
        `rightTick_${i}`,
        { width: 0.2, height: 0.08, depth: 2.1 },
        this.scene
      );
      rightTick.position.set(14.9, i * 2.0 - 56.0, 0);
      rightTick.material = tickMat;
      rightTick.metadata = { type: "scrolling_tick", index: i, initialY: i * 2.0 - 56.0 };
    }
  }
}
