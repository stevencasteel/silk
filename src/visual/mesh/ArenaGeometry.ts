import * as BABYLON from "@babylonjs/core";
import { ARENA_CONFIG } from "../../core/engine/ArenaConfig";
import { ProceduralTextureGenerator } from "../scene/ProceduralTextureGenerator";

export class ArenaGeometry {
  constructor(private scene: BABYLON.Scene) {}

  public generateElevatorShaft(): void {
    const textureGen = new ProceduralTextureGenerator();

    const wallMaterial = new BABYLON.PBRMaterial("wallMat", this.scene);
    wallMaterial.metallic = 0.0;
    wallMaterial.roughness = 0.85;
    wallMaterial.albedoColor = new BABYLON.Color3(0.043, 0.051, 0.063);

    textureGen.generatePBRTextures("concreteWall", this.scene, {
      resolution: 512,
      noiseScale: 10.0,
      bumpStrength: 2.5,
      baseColor: new BABYLON.Color3(0.043, 0.051, 0.063),
      roughnessMin: 0.75,
      roughnessMax: 0.98,
      metallic: 0.0
    }).then((wallTexs) => {
      wallMaterial.albedoTexture = wallTexs.albedo;
      wallMaterial.bumpTexture = wallTexs.normal;
      wallMaterial.metallicTexture = wallTexs.orm;
      wallMaterial.useAmbientOcclusionFromMetallicTextureRed = true;
      wallMaterial.useRoughnessFromMetallicTextureGreen = true;
      wallMaterial.useMetallnessFromMetallicTextureBlue = true;
      wallMaterial.useRoughnessFromMetallicTextureAlpha = false;
      wallMaterial.enableSpecularAntiAliasing = true;
      wallMaterial.forceIrradianceInFragment = true;
    });

    const panelMaterial = new BABYLON.PBRMaterial("panelMat", this.scene);
    panelMaterial.metallic = 0.25;
    panelMaterial.roughness = 0.65;
    panelMaterial.albedoColor = new BABYLON.Color3(0.08, 0.09, 0.11);

    textureGen.generatePBRTextures("scrollingPanel", this.scene, {
      resolution: 512,
      noiseScale: 16.0,
      bumpStrength: 1.8,
      baseColor: new BABYLON.Color3(0.08, 0.09, 0.11),
      roughnessMin: 0.45,
      roughnessMax: 0.75,
      metallic: 0.2
    }).then((panelTexs) => {
      panelMaterial.albedoTexture = panelTexs.albedo;
      panelMaterial.bumpTexture = panelTexs.normal;
      panelMaterial.metallicTexture = panelTexs.orm;
      panelMaterial.useAmbientOcclusionFromMetallicTextureRed = true;
      panelMaterial.useRoughnessFromMetallicTextureGreen = true;
      panelMaterial.useMetallnessFromMetallicTextureBlue = true;
      panelMaterial.useRoughnessFromMetallicTextureAlpha = false;
      panelMaterial.enableSpecularAntiAliasing = true;
      panelMaterial.forceIrradianceInFragment = true;
    });

    const verticalGrooveMaterial = new BABYLON.PBRMaterial("grooveMat", this.scene);
    verticalGrooveMaterial.albedoColor = new BABYLON.Color3(0.015, 0.015, 0.02);
    verticalGrooveMaterial.roughness = 0.98;
    verticalGrooveMaterial.metallic = 0.0;

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

    const panelBase = BABYLON.MeshBuilder.CreateBox(
      "panelBase",
      { width: 1.0, height: 1.0, depth: 1.0 },
      this.scene
    );
    panelBase.material = panelMaterial;
    panelBase.isVisible = false;

    const ribBase = BABYLON.MeshBuilder.CreateBox(
      "ribBase",
      { width: 0.25, height: 1.0, depth: 1.0 },
      this.scene
    );
    ribBase.material = verticalGrooveMaterial;
    ribBase.isVisible = false;

    const panelCount = 20;
    const panelSpacing = wallHeight / panelCount;
    for (let i = 0; i < panelCount; i++) {
      const panelY = (i - panelCount / 2) * panelSpacing + (wallHeight * 0.1);

      const heightScale = 0.45 + Math.abs(Math.sin(i * 1.5)) * 0.45;
      const panelHeight = panelSpacing * heightScale;

      const widthScale = 0.8 + Math.abs(Math.cos(i * 2.1)) * 0.35;
      const panelWidth = 0.1 * widthScale;

      const depthScale = 0.7 + Math.abs(Math.sin(i * 3.3)) * 0.45;
      const panelDepth = 3.6 * depthScale;

      const lp = panelBase.createInstance(`leftPanel_${i}`);
      lp.position.set(-wallX + wallThickness / 2 - 0.02, panelY, 0);
      lp.scaling.set(panelWidth, panelHeight, panelDepth);
      lp.receiveShadows = true;
      lp.metadata = { type: "scrolling_panel", index: i, initialY: panelY };

      const rp = panelBase.createInstance(`rightPanel_${i}`);
      rp.position.set(wallX - wallThickness / 2 + 0.02, panelY, 0);
      rp.scaling.set(panelWidth, panelHeight, panelDepth);
      rp.receiveShadows = true;
      rp.metadata = { type: "scrolling_panel", index: i, initialY: panelY };
    }

    const ribCount = 10;
    const ribSpacing = wallHeight / ribCount;
    for (let i = 0; i < ribCount; i++) {
      const ribY = (i - ribCount / 2) * ribSpacing + (wallHeight * 0.1);

      const ribHeight = 0.18 + Math.abs(Math.sin(i * 1.9)) * 0.22;
      const ribDepth = 4.15;

      const leftRib = ribBase.createInstance(`leftRib_${i}`);
      leftRib.position.set(-wallX + wallThickness / 2, ribY, 0);
      leftRib.scaling.set(1.0, ribHeight, ribDepth);
      leftRib.receiveShadows = true;
      leftRib.metadata = { type: "scrolling_rib", index: i, initialY: ribY };

      const rightRib = ribBase.createInstance(`rightRib_${i}`);
      rightRib.position.set(wallX - wallThickness / 2, ribY, 0);
      rightRib.scaling.set(1.0, ribHeight, ribDepth);
      rightRib.receiveShadows = true;
      rightRib.metadata = { type: "scrolling_rib", index: i, initialY: ribY };
    }

    const tickMat = new BABYLON.PBRMaterial("tickMat", this.scene);
    tickMat.albedoColor = new BABYLON.Color3(0.1, 0.13, 0.16);
    tickMat.metallic = 0.3;
    tickMat.roughness = 0.4;
    tickMat.emissiveColor = new BABYLON.Color3(0.45, 0.65, 0.85);
    tickMat.emissiveIntensity = 1.1;

    const tickBase = BABYLON.MeshBuilder.CreateBox(
      "tickBase",
      { width: 0.2, height: 0.08, depth: 2.1 },
      this.scene
    );
    tickBase.material = tickMat;
    tickBase.isVisible = false;

    const tickCount = 70;
    const tickSpacing = 2.0;
    const initialYOffset = -56.0;
    const tickX = ARENA_CONFIG.HORIZONTAL.TICK_GEOMETRY_X;

    for (let i = 0; i < tickCount; i++) {
      const initialY = i * tickSpacing + initialYOffset;

      const leftTick = tickBase.createInstance(`leftTick_${i}`);
      leftTick.position.set(-tickX, initialY, 0);
      leftTick.metadata = { type: "scrolling_tick", index: i, initialY: initialY };

      const rightTick = tickBase.createInstance(`rightTick_${i}`);
      rightTick.position.set(tickX, initialY, 0);
      rightTick.metadata = { type: "scrolling_tick", index: i, initialY: initialY };
    }
  }
}
