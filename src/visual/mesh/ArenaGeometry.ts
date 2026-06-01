import { configurePBRTextures } from "../../core/utils/EngineUtils";
import * as BABYLON from "@babylonjs/core";
import { ARENA_CONFIG } from "../../core/engine/ArenaConfig";
import { ProceduralTextureGenerator } from "../scene/ProceduralTextureGenerator";

export class ArenaGeometry {
  constructor(private scene: BABYLON.Scene) {}

  public async generateElevatorShaft(): Promise<void> {
    const textureGen = new ProceduralTextureGenerator();
    const isMobile = typeof window !== "undefined" && (window.innerWidth < 768 || navigator.maxTouchPoints > 0);
    const wallRes = isMobile ? 256 : 512;
    const panelRes = isMobile ? 256 : 512;
    const backdropRes = isMobile ? 512 : 1024;

    const wallMaterial = new BABYLON.PBRMaterial("wallMat", this.scene);
    wallMaterial.metallic = 0.0;
    wallMaterial.roughness = 0.85;
    wallMaterial.albedoColor = new BABYLON.Color3(0.043, 0.051, 0.063);

    const panelMaterial = new BABYLON.PBRMaterial("panelMat", this.scene);
    panelMaterial.metallic = 0.25;
    panelMaterial.roughness = 0.65;
    panelMaterial.albedoColor = new BABYLON.Color3(0.08, 0.09, 0.11);

    const verticalGrooveMaterial = new BABYLON.PBRMaterial("grooveMat", this.scene);
    verticalGrooveMaterial.albedoColor = new BABYLON.Color3(0.015, 0.015, 0.02);
    verticalGrooveMaterial.roughness = 0.98;
    verticalGrooveMaterial.metallic = 0.0;

    const backdropMaterial = new BABYLON.PBRMaterial("shaftBackdropMat", this.scene);
    backdropMaterial.metallic = 0.0;
    backdropMaterial.roughness = 0.94;
    backdropMaterial.albedoColor = new BABYLON.Color3(0.026, 0.03, 0.037);

    const backdropPanelMaterial = new BABYLON.PBRMaterial("shaftBackdropPanelMat", this.scene);
    backdropPanelMaterial.metallic = 0.05;
    backdropPanelMaterial.roughness = 0.88;
    backdropPanelMaterial.albedoColor = new BABYLON.Color3(0.038, 0.043, 0.052);

    const backdropPanelMaterial2 = new BABYLON.PBRMaterial("shaftBackdropPanelMat2", this.scene);
    backdropPanelMaterial2.metallic = 0.08;
    backdropPanelMaterial2.roughness = 0.82;
    backdropPanelMaterial2.albedoColor = new BABYLON.Color3(0.045, 0.051, 0.062);

    const backdropPanelMaterial3 = new BABYLON.PBRMaterial("shaftBackdropPanelMat3", this.scene);
    backdropPanelMaterial3.metallic = 0.03;
    backdropPanelMaterial3.roughness = 0.91;
    backdropPanelMaterial3.albedoColor = new BABYLON.Color3(0.032, 0.037, 0.045);

    const backdropPanelMaterial4 = new BABYLON.PBRMaterial("shaftBackdropPanelMat4", this.scene);
    backdropPanelMaterial4.metallic = 0.06;
    backdropPanelMaterial4.roughness = 0.86;
    backdropPanelMaterial4.albedoColor = new BABYLON.Color3(0.041, 0.047, 0.057);

    const gashMaterial = new BABYLON.PBRMaterial("shaftGashMat", this.scene);
    gashMaterial.albedoColor = new BABYLON.Color3(0.007, 0.008, 0.011);
    gashMaterial.roughness = 1.0;
    gashMaterial.metallic = 0.0;

    const crackMaterial = new BABYLON.PBRMaterial("shaftCrackMat", this.scene);
    crackMaterial.albedoColor = new BABYLON.Color3(0.005, 0.006, 0.008);
    crackMaterial.roughness = 0.95;
    crackMaterial.metallic = 0.0;

    const dentMaterial = new BABYLON.PBRMaterial("shaftDentMat", this.scene);
    dentMaterial.albedoColor = new BABYLON.Color3(0.012, 0.014, 0.018);
    dentMaterial.roughness = 0.92;
    dentMaterial.metallic = 0.05;

    const texturesPromise = Promise.all([
      textureGen
        .generatePBRTextures("concreteWall", this.scene, {
          resolution: wallRes,
          noiseScale: 10.0,
          bumpStrength: 2.5,
          baseColor: new BABYLON.Color3(0.043, 0.051, 0.063),
          roughnessMin: 0.75,
          roughnessMax: 0.98,
          metallic: 0.0
        })
        .then((textures) => {
          configurePBRTextures(wallMaterial, textures);
          wallMaterial.enableSpecularAntiAliasing = true;
          wallMaterial.forceIrradianceInFragment = true;
        }),

      textureGen
        .generatePBRTextures("scrollingPanel", this.scene, {
          resolution: panelRes,
          noiseScale: 16.0,
          bumpStrength: 1.8,
          baseColor: new BABYLON.Color3(0.08, 0.09, 0.11),
          roughnessMin: 0.45,
          roughnessMax: 0.75,
          metallic: 0.2
        })
        .then((textures) => {
          configurePBRTextures(panelMaterial, textures);
          panelMaterial.enableSpecularAntiAliasing = true;
          panelMaterial.forceIrradianceInFragment = true;
        }),

      textureGen
        .generatePBRTextures("shaftBackdropConcrete", this.scene, {
          resolution: backdropRes,
          noiseScale: 14.0,
          bumpStrength: 4.2,
          baseColor: new BABYLON.Color3(0.026, 0.03, 0.037),
          roughnessMin: 0.78,
          roughnessMax: 0.99,
          metallic: 0.0,
          ridgeStrength: 0.22,
          ridgeScale: 0.42,
          ridgeDirectionX: 0.72,
          ridgeDirectionY: 1.0,
          colorVariation: 0.28
        })
        .then((textures) => {
          configurePBRTextures(backdropMaterial, textures);
          backdropMaterial.enableSpecularAntiAliasing = true;
          backdropMaterial.forceIrradianceInFragment = true;
        })
    ]);

    await texturesPromise;

    const wallThickness = 2.0;
    const wallHeight = ARENA_CONFIG.VERTICAL.WALL_GEOMETRY_HEIGHT;
    const wallX = ARENA_CONFIG.HORIZONTAL.WALL_GEOMETRY_X;
    const backdropWidth = ARENA_CONFIG.HORIZONTAL.PLAY_AREA_HALF_WIDTH * 1.92;
    const backdropZ = 2.35;

    const backWall = BABYLON.MeshBuilder.CreateBox(
      "shaftBackdropWall",
      { width: backdropWidth, height: wallHeight, depth: 0.36 },
      this.scene
    );
    backWall.position.set(0, wallHeight * 0.1, backdropZ);
    backWall.material = backdropMaterial;
    backWall.receiveShadows = true;

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
    panelBase.receiveShadows = true;

    const ribBase = BABYLON.MeshBuilder.CreateBox(
      "ribBase",
      { width: 0.25, height: 1.0, depth: 1.0 },
      this.scene
    );
    ribBase.material = verticalGrooveMaterial;
    ribBase.isVisible = false;
    ribBase.receiveShadows = true;

    const backdropPanelBase = BABYLON.MeshBuilder.CreateBox(
      "backdropPanelBase",
      { width: 1.0, height: 1.0, depth: 0.08 },
      this.scene
    );
    backdropPanelBase.material = backdropPanelMaterial;
    backdropPanelBase.isVisible = false;
    backdropPanelBase.receiveShadows = true;

    const backdropPanelBase2 = BABYLON.MeshBuilder.CreateBox(
      "backdropPanelBase2",
      { width: 1.0, height: 1.0, depth: 0.08 },
      this.scene
    );
    backdropPanelBase2.material = backdropPanelMaterial2;
    backdropPanelBase2.isVisible = false;
    backdropPanelBase2.receiveShadows = true;

    const backdropPanelBase3 = BABYLON.MeshBuilder.CreateBox(
      "backdropPanelBase3",
      { width: 1.0, height: 1.0, depth: 0.08 },
      this.scene
    );
    backdropPanelBase3.material = backdropPanelMaterial3;
    backdropPanelBase3.isVisible = false;
    backdropPanelBase3.receiveShadows = true;

    const backdropPanelBase4 = BABYLON.MeshBuilder.CreateBox(
      "backdropPanelBase4",
      { width: 1.0, height: 1.0, depth: 0.08 },
      this.scene
    );
    backdropPanelBase4.material = backdropPanelMaterial4;
    backdropPanelBase4.isVisible = false;
    backdropPanelBase4.receiveShadows = true;

    const backdropGashBase = BABYLON.MeshBuilder.CreateBox(
      "backdropGashBase",
      { width: 1.0, height: 1.0, depth: 0.1 },
      this.scene
    );
    backdropGashBase.material = gashMaterial;
    backdropGashBase.isVisible = false;
    backdropGashBase.receiveShadows = false;

    const backdropCrackBase = BABYLON.MeshBuilder.CreateBox(
      "backdropCrackBase",
      { width: 1.0, height: 1.0, depth: 0.06 },
      this.scene
    );
    backdropCrackBase.material = crackMaterial;
    backdropCrackBase.isVisible = false;
    backdropCrackBase.receiveShadows = false;

    const backdropDentBase = BABYLON.MeshBuilder.CreateBox(
      "backdropDentBase",
      { width: 1.0, height: 1.0, depth: 0.15 },
      this.scene
    );
    backdropDentBase.material = dentMaterial;
    backdropDentBase.isVisible = false;
    backdropDentBase.receiveShadows = true;

    const backdropPanelCount = 28;
    const backdropPanelSpacing = wallHeight / backdropPanelCount;
    for (let i = 0; i < backdropPanelCount; i++) {
      const panelY = (i - backdropPanelCount / 2) * backdropPanelSpacing + wallHeight * 0.1;
      const bandOffset = Math.sin(i * 2.17) * backdropWidth * 0.16;
      const panelWidth = backdropWidth * (0.28 + Math.abs(Math.sin(i * 1.31)) * 0.24);
      const panelHeight = backdropPanelSpacing * (0.62 + Math.abs(Math.cos(i * 0.93)) * 0.42);
      const panelDepth = 0.09 + Math.abs(Math.sin(i * 4.73)) * 0.07;

      // Vary panel material for color variety
      const materialVariant = i % 4;
      let panelBase;
      if (materialVariant === 0) panelBase = backdropPanelBase;
      else if (materialVariant === 1) panelBase = backdropPanelBase2;
      else if (materialVariant === 2) panelBase = backdropPanelBase3;
      else panelBase = backdropPanelBase4;

      const backdropPanel = panelBase.createInstance(`backdropPanel_${i}`);
      backdropPanel.position.set(bandOffset, panelY, backdropZ - 0.22);
      backdropPanel.scaling.set(panelWidth, panelHeight, panelDepth);

      backdropPanel.metadata = { type: "scrolling_backdrop_panel", index: i, initialY: panelY };

      if (i % 3 !== 1) {
        const seam = backdropGashBase.createInstance(`backdropPanelSeam_${i}`);
        seam.position.set(
          bandOffset + Math.sin(i * 5.1) * panelWidth * 0.38,
          panelY + Math.cos(i * 2.9) * panelHeight * 0.24,
          backdropZ - 0.285
        );
        seam.scaling.set(panelWidth * (0.32 + Math.abs(Math.cos(i * 1.7)) * 0.24), 0.035, 0.12);
        seam.rotation.z = Math.sin(i * 1.9) * 0.34;

        seam.metadata = { type: "scrolling_backdrop_gash", index: i, initialY: seam.position.y };
      }
    }

    const gashCount = 34;
    const gashSpacing = wallHeight / gashCount;
    for (let i = 0; i < gashCount; i++) {
      const scratchY = (i - gashCount / 2) * gashSpacing + wallHeight * 0.1;
      const scratchX = Math.sin(i * 3.83) * backdropWidth * 0.43;
      
      // Vary damage type based on index
      const damageType = i % 3;
      let damageMesh;
      
      if (damageType === 0) {
        // Deep gash
        damageMesh = backdropGashBase.createInstance(`backdropGash_${i}`);
        damageMesh.position.set(scratchX, scratchY, backdropZ - 0.31);
        damageMesh.scaling.set(
          0.06 + Math.abs(Math.sin(i * 1.41)) * 0.08,
          0.75 + Math.abs(Math.cos(i * 2.37)) * 1.15,
          0.14
        );
        damageMesh.rotation.z = Math.sin(i * 2.61) * 0.92;
      } else if (damageType === 1) {
        // Thin crack
        damageMesh = backdropCrackBase.createInstance(`backdropCrack_${i}`);
        damageMesh.position.set(
          scratchX + Math.cos(i * 1.9) * backdropWidth * 0.12,
          scratchY + Math.sin(i * 2.3) * 0.5,
          backdropZ - 0.28
        );
        damageMesh.scaling.set(
          0.02 + Math.abs(Math.sin(i * 2.8)) * 0.03,
          1.2 + Math.abs(Math.cos(i * 1.7)) * 0.8,
          0.08
        );
        damageMesh.rotation.z = Math.sin(i * 3.1) * 1.4 + Math.cos(i * 1.5) * 0.5;
      } else {
        // Shallow dent
        damageMesh = backdropDentBase.createInstance(`backdropDent_${i}`);
        damageMesh.position.set(
          scratchX - Math.sin(i * 2.1) * backdropWidth * 0.18,
          scratchY + Math.cos(i * 1.8) * 0.4,
          backdropZ - 0.26
        );
        damageMesh.scaling.set(
          0.15 + Math.abs(Math.cos(i * 2.4)) * 0.12,
          0.25 + Math.abs(Math.sin(i * 1.9)) * 0.2,
          0.18
        );
        damageMesh.rotation.z = Math.cos(i * 2.7) * 0.6;
      }

      damageMesh.metadata = { type: "scrolling_backdrop_gash", index: i + 100, initialY: scratchY };
    }

    const panelCount = 20;
    const panelSpacing = wallHeight / panelCount;
    for (let i = 0; i < panelCount; i++) {
      const panelY = (i - panelCount / 2) * panelSpacing + wallHeight * 0.1;

      const heightScale = 0.45 + Math.abs(Math.sin(i * 1.5)) * 0.45;
      const panelHeight = panelSpacing * heightScale;

      const widthScale = 0.8 + Math.abs(Math.cos(i * 2.1)) * 0.35;
      const panelWidth = 0.1 * widthScale;

      const depthScale = 0.7 + Math.abs(Math.sin(i * 3.3)) * 0.45;
      const panelDepth = 3.6 * depthScale;

      const lp = panelBase.createInstance(`leftPanel_${i}`);
      lp.position.set(-wallX + wallThickness / 2 - 0.02, panelY, 0);
      lp.scaling.set(panelWidth, panelHeight, panelDepth);

      lp.metadata = { type: "scrolling_panel", index: i, initialY: panelY };

      const rp = panelBase.createInstance(`rightPanel_${i}`);
      rp.position.set(wallX - wallThickness / 2 + 0.02, panelY, 0);
      rp.scaling.set(panelWidth, panelHeight, panelDepth);

      rp.metadata = { type: "scrolling_panel", index: i, initialY: panelY };
    }

    const ribCount = 10;
    const ribSpacing = wallHeight / ribCount;
    for (let i = 0; i < ribCount; i++) {
      const ribY = (i - ribCount / 2) * ribSpacing + wallHeight * 0.1;

      const ribHeight = 0.18 + Math.abs(Math.sin(i * 1.9)) * 0.22;
      const ribDepth = 4.15;

      const leftRib = ribBase.createInstance(`leftRib_${i}`);
      leftRib.position.set(-wallX + wallThickness / 2, ribY, 0);
      leftRib.scaling.set(1.0, ribHeight, ribDepth);

      leftRib.metadata = { type: "scrolling_rib", index: i, initialY: ribY };

      const rightRib = ribBase.createInstance(`rightRib_${i}`);
      rightRib.position.set(wallX - wallThickness / 2, ribY, 0);
      rightRib.scaling.set(1.0, ribHeight, ribDepth);

      rightRib.metadata = { type: "scrolling_rib", index: i, initialY: ribY };
    }

    const tickMat = new BABYLON.PBRMaterial("tickMat", this.scene);
    tickMat.albedoColor = new BABYLON.Color3(0.027, 0.431, 0.749);
    tickMat.metallic = 0.3;
    tickMat.roughness = 0.4;
    tickMat.emissiveColor = new BABYLON.Color3(0.0, 0.35, 0.65);
    tickMat.emissiveIntensity = 0.5;

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
