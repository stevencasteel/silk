import * as BABYLON from "@babylonjs/core";
import { ARENA_CONFIG } from "../../core/engine/ArenaConfig";

export class ArenaGeometry {
  constructor(private scene: BABYLON.Scene) {}

  public generateElevatorShaft(): void {
    const wallMaterial = new BABYLON.PBRMaterial("wallMat", this.scene);
    wallMaterial.albedoColor = new BABYLON.Color3(0.06, 0.06, 0.07);
    wallMaterial.metallic = 0.1;
    wallMaterial.roughness = 0.85;

    const wallThickness = 2.0;
    const wallHeight = ARENA_CONFIG.VERTICAL.WALL_GEOMETRY_HEIGHT;
    const wallX = ARENA_CONFIG.HORIZONTAL.WALL_GEOMETRY_X;

    const leftWall = BABYLON.MeshBuilder.CreateBox(
      "leftWall",
      { width: wallThickness, height: wallHeight, depth: 4 },
      this.scene
    );
    leftWall.position.set(-wallX, wallHeight * 0.1, 0);
    leftWall.material = wallMaterial;
    leftWall.receiveShadows = true;

    const rightWall = BABYLON.MeshBuilder.CreateBox(
      "rightWall",
      { width: wallThickness, height: wallHeight, depth: 4 },
      this.scene
    );
    rightWall.position.set(wallX, wallHeight * 0.1, 0);
    rightWall.material = wallMaterial;
    rightWall.receiveShadows = true;

    const tickMat = new BABYLON.PBRMaterial("tickMat", this.scene);
    tickMat.albedoColor = new BABYLON.Color3(0.05, 0.08, 0.12);
    tickMat.metallic = 0.0;
    tickMat.roughness = 0.5;
    tickMat.emissiveColor = new BABYLON.Color3(0.15, 0.4, 0.8);
    tickMat.emissiveIntensity = 1.5;

    const tickCount = 70;
    const tickSpacing = 2.0;
    const initialYOffset = -56.0;
    const tickX = ARENA_CONFIG.HORIZONTAL.TICK_GEOMETRY_X;

    for (let i = 0; i < tickCount; i++) {
      const initialY = i * tickSpacing + initialYOffset;

      const leftTick = BABYLON.MeshBuilder.CreateBox(
        `leftTick_${i}`,
        { width: 0.2, height: 0.08, depth: 2.1 },
        this.scene
      );
      leftTick.position.set(-tickX, initialY, 0);
      leftTick.material = tickMat;
      leftTick.metadata = { type: "scrolling_tick", index: i, initialY: initialY };

      const rightTick = BABYLON.MeshBuilder.CreateBox(
        `rightTick_${i}`,
        { width: 0.2, height: 0.08, depth: 2.1 },
        this.scene
      );
      rightTick.position.set(tickX, initialY, 0);
      rightTick.material = tickMat;
      rightTick.metadata = { type: "scrolling_tick", index: i, initialY: initialY };
    }
  }
}
