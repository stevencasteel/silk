import * as BABYLON from "@babylonjs/core";
import { VISUAL_JUICE_CONFIG } from "../../core/engine/ArenaConfig";

export class HealthBugVisualFactory {
  public static buildBugMeshHierarchy(
    id: number,
    scene: BABYLON.Scene,
    variant: "NORMAL" | "SPIKED_TOP" | "SPIKED_RIGHT" | "SPIKED_BOTTOM" | "SPIKED_LEFT"
  ): BABYLON.TransformNode {
    const root = new BABYLON.TransformNode(`health_bug_root_${id}`, scene);

    // 1. Bulbous Glass Outer Shell (Diameter 4.0)
    const glass = BABYLON.MeshBuilder.CreateSphere(
      `health_bug_glass_${id}`,
      { diameter: 4.0, segments: 16 },
      scene
    );
    
    const glassMat = new BABYLON.PBRMaterial(`health_bug_glass_mat_${id}`, scene);
    glassMat.metallic = 0.1;
    glassMat.roughness = 0.05;
    glassMat.alpha = 0.32;
    glassMat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
    glassMat.albedoColor = new BABYLON.Color3(0.9, 0.95, 1.0);
    glassMat.clearCoat.isEnabled = true;
    glassMat.clearCoat.intensity = 1.0;
    glassMat.clearCoat.roughness = 0.02;
    glass.material = glassMat;
    glass.parent = root;

    // 2. Inner Glowing Core with Sharp Split Color Grammar
    const core = BABYLON.MeshBuilder.CreateSphere(
      `health_bug_core_${id}`,
      { diameter: 2.5, segments: 12 },
      scene
    );
    core.parent = root;

    const coreMat = new BABYLON.PBRMaterial(`health_bug_core_mat_${id}`, scene);
    coreMat.roughness = 0.15;
    coreMat.metallic = 0.02;

    const spikeColor = VISUAL_JUICE_CONFIG.WALL_BUG_COLORS.SPIKE_RED;
    const greenColor = { r: 0.1, g: 0.95, b: 0.15 };

    const redStyle = `rgb(${Math.floor(spikeColor.r * 255)}, ${Math.floor(spikeColor.g * 255)}, ${Math.floor(spikeColor.b * 255)})`;
    const greenStyle = `rgb(${Math.floor(greenColor.r * 255)}, ${Math.floor(greenColor.g * 255)}, ${Math.floor(greenColor.b * 255)})`;

    if (variant === "NORMAL") {
      coreMat.albedoColor = new BABYLON.Color3(greenColor.r, greenColor.g, greenColor.b);
      coreMat.emissiveColor = new BABYLON.Color3(greenColor.r * 1.5, greenColor.g * 1.5, greenColor.b * 1.5);
    } else {
      const res = 128;
      const dynTex = new BABYLON.DynamicTexture(`health_bug_core_tex_${id}`, res, scene, true);
      const ctx = dynTex.getContext() as unknown as CanvasRenderingContext2D;

      // Draw standard top-half Red, bottom-half Green texture split
      ctx.fillStyle = redStyle;
      ctx.fillRect(0, 0, res, res / 2);
      ctx.fillStyle = greenStyle;
      ctx.fillRect(0, res / 2, res, res / 2);
      dynTex.update();

      coreMat.albedoTexture = dynTex;
      coreMat.emissiveTexture = dynTex;
      coreMat.emissiveColor = new BABYLON.Color3(1.3, 1.3, 1.3);

      // Set rotation strictly using Quaternion to ensure the pipeline respects the alignment
      if (variant === "SPIKED_TOP") {
        core.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, Math.PI);
      } else if (variant === "SPIKED_BOTTOM") {
        core.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, 0);
      } else if (variant === "SPIKED_LEFT") {
        core.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, -Math.PI / 2);
      } else if (variant === "SPIKED_RIGHT") {
        core.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, Math.PI / 2);
      }
    }
    core.material = coreMat;

    // 3. Rotor Fin Assembly
    const rotorRoot = new BABYLON.TransformNode(`health_bug_rotors_${id}`, scene);
    rotorRoot.position.set(0, 2.2, 0);
    rotorRoot.parent = root;

    const stem = BABYLON.MeshBuilder.CreateCylinder(
      `rotor_stem_${id}`,
      { height: 0.55, diameter: 0.2 },
      scene
    );
    stem.position.set(0, -0.25, 0);
    
    const metalMat = new BABYLON.PBRMaterial(`health_bug_metal_mat_${id}`, scene);
    metalMat.metallic = 0.95;
    metalMat.roughness = 0.15;
    metalMat.albedoColor = new BABYLON.Color3(0.5, 0.53, 0.58);
    stem.material = metalMat;
    stem.parent = rotorRoot;

    const blade1 = BABYLON.MeshBuilder.CreateBox(
      `blade1_${id}`,
      { width: 3.25, height: 0.05, depth: 0.375 },
      scene
    );
    blade1.material = metalMat;
    blade1.parent = rotorRoot;

    const blade2 = BABYLON.MeshBuilder.CreateBox(
      `blade2_${id}`,
      { width: 0.375, height: 0.05, depth: 3.25 },
      scene
    );
    blade2.material = metalMat;
    blade2.parent = rotorRoot;

    // 4. Large Obvious Spikes covering a full 180-degree semicircle (11 Spikes, zero gaps)
    if (variant !== "NORMAL") {
      const spikeMat = new BABYLON.StandardMaterial(`health_bug_spike_mat_${id}`, scene);
      spikeMat.emissiveColor = new BABYLON.Color3(spikeColor.r, spikeColor.g, spikeColor.b);
      spikeMat.disableLighting = true;

      const spikeContainer = new BABYLON.TransformNode(`spikes_container_${id}`, scene);
      spikeContainer.parent = root;

      const spikeCount = 11;
      for (let s = 0; s < spikeCount; s++) {
        // Evenly distribute from -PI/2 to +PI/2
        const theta = -Math.PI / 2 + (s / (spikeCount - 1)) * Math.PI;

        const spike = BABYLON.MeshBuilder.CreateCylinder(
          `spike_${id}_${s}`,
          { height: 1.8, diameterTop: 0.0, diameterBottom: 0.75, tessellation: 6 },
          scene
        );
        spike.material = spikeMat;
        spike.parent = spikeContainer;

        const baseDist = 2.1;

        if (variant === "SPIKED_TOP") {
          spike.position.set(Math.sin(theta) * baseDist, Math.cos(theta) * baseDist, 0);
          spike.rotation.z = -theta;
        } else if (variant === "SPIKED_BOTTOM") {
          spike.position.set(Math.sin(theta) * baseDist, -Math.cos(theta) * baseDist, 0);
          spike.rotation.z = Math.PI + theta;
        } else if (variant === "SPIKED_LEFT") {
          spike.position.set(-Math.cos(theta) * baseDist, Math.sin(theta) * baseDist, 0);
          spike.rotation.z = Math.PI / 2 - theta;
        } else if (variant === "SPIKED_RIGHT") {
          spike.position.set(Math.cos(theta) * baseDist, Math.sin(theta) * baseDist, 0);
          spike.rotation.z = -Math.PI / 2 + theta;
        }
      }
    }

    return root;
  }
}
