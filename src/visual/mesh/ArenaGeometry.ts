import * as BABYLON from "@babylonjs/core";
import { ARENA_CONFIG } from "../../core/engine/ArenaConfig";

export class ArenaGeometry {
  constructor(private scene: BABYLON.Scene) {}

  public generateElevatorShaft(): void {
    const wallMaterial = new BABYLON.PBRMaterial("wallMat", this.scene);
    wallMaterial.albedoColor = new BABYLON.Color3(0.043, 0.051, 0.063);
    wallMaterial.metallic = 0.15;
    wallMaterial.roughness = 0.85;

    const panelMaterial = new BABYLON.PBRMaterial("panelMat", this.scene);
    panelMaterial.albedoColor = new BABYLON.Color3(0.08, 0.09, 0.11);
    panelMaterial.metallic = 0.2;
    panelMaterial.roughness = 0.7;

    const verticalGrooveMaterial = new BABYLON.PBRMaterial("grooveMat", this.scene);
    verticalGrooveMaterial.albedoColor = new BABYLON.Color3(0.02, 0.02, 0.03);
    verticalGrooveMaterial.roughness = 0.95;

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

    const leftGroove = BABYLON.MeshBuilder.CreateBox(
      "leftWallGroove",
      { width: 0.08, height: wallHeight, depth: 3.8 },
      this.scene
    );
    leftGroove.position.set(-wallX + wallThickness / 2 - 0.04, wallHeight * 0.1, 0.02);
    leftGroove.material = verticalGrooveMaterial;
    leftGroove.receiveShadows = false;

    const rightGroove = BABYLON.MeshBuilder.CreateBox(
      "rightWallGroove",
      { width: 0.08, height: wallHeight, depth: 3.8 },
      this.scene
    );
    rightGroove.position.set(wallX - wallThickness / 2 + 0.04, wallHeight * 0.1, 0.02);
    rightGroove.material = verticalGrooveMaterial;
    rightGroove.receiveShadows = false;

    const panelCount = 12;
    const panelSpacing = wallHeight / panelCount;
    for (let i = 0; i < panelCount; i++) {
      const panelY = (i - panelCount / 2) * panelSpacing + (wallHeight * 0.1);

      const lp = BABYLON.MeshBuilder.CreateBox(
        `leftPanel_${i}`,
        { width: 0.1, height: panelSpacing * 0.7, depth: 3.6 },
        this.scene
      );
      lp.position.set(-wallX + wallThickness / 2 - 0.02, panelY, 0);
      lp.material = panelMaterial;
      lp.receiveShadows = true;

      const rp = BABYLON.MeshBuilder.CreateBox(
        `rightPanel_${i}`,
        { width: 0.1, height: panelSpacing * 0.7, depth: 3.6 },
        this.scene
      );
      rp.position.set(wallX - wallThickness / 2 + 0.02, panelY, 0);
      rp.material = panelMaterial;
      rp.receiveShadows = true;
    }

    const tickMat = new BABYLON.PBRMaterial("tickMat", this.scene);
    tickMat.albedoColor = new BABYLON.Color3(0.1, 0.13, 0.16);
    tickMat.metallic = 0.3;
    tickMat.roughness = 0.4;
    tickMat.emissiveColor = new BABYLON.Color3(0.45, 0.65, 0.85);
    tickMat.emissiveIntensity = 1.1;

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
