import * as BABYLON from "@babylonjs/core";
import { VISUAL_JUICE_CONFIG } from "../../core/engine/ArenaConfig";

export class FaunaVisualFactory {
  public static buildHealthBug(
    id: number,
    scene: BABYLON.Scene,
    variant: "NORMAL" | "SPIKED_TOP" | "SPIKED_RIGHT" | "SPIKED_BOTTOM" | "SPIKED_LEFT"
  ): BABYLON.TransformNode {
    const root = new BABYLON.TransformNode(`health_bug_root_${id}`, scene);

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

      ctx.fillStyle = redStyle;
      ctx.fillRect(0, 0, res, res / 2);
      ctx.fillStyle = greenStyle;
      ctx.fillRect(0, res / 2, res, res / 2);
      dynTex.update();

      coreMat.albedoTexture = dynTex;
      coreMat.emissiveTexture = dynTex;
      coreMat.emissiveColor = new BABYLON.Color3(1.3, 1.3, 1.3);

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

    const rotorRoot = new BABYLON.TransformNode(`health_bug_rotors_${id}`, scene);
    rotorRoot.parent = root;
    rotorRoot.position.set(0, 2.2, 0);

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

    if (variant !== "NORMAL") {
      const spikeMat = new BABYLON.StandardMaterial(`health_bug_spike_mat_${id}`, scene);
      spikeMat.emissiveColor = new BABYLON.Color3(spikeColor.r, spikeColor.g, spikeColor.b);
      spikeMat.disableLighting = true;

      const spikeContainer = new BABYLON.TransformNode(`spikes_container_${id}`, scene);
      spikeContainer.parent = root;

      const spikeCount = 11;
      for (let s = 0; s < spikeCount; s++) {
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

  public static buildWallBug(
    id: number,
    scene: BABYLON.Scene,
    bugMaterial: BABYLON.Material,
    eyeMaterial: BABYLON.Material
  ): BABYLON.TransformNode {
    const bugRoot = new BABYLON.TransformNode(`wall_bug_root_${id}`, scene);

    const capsule = BABYLON.MeshBuilder.CreateCapsule(
      `wall_bug_capsule_${id}`,
      { height: 7.2, radius: 0.58, subdivisions: 2 },
      scene
    );
    capsule.material = bugMaterial;
    capsule.parent = bugRoot;

    const stripeMat = new BABYLON.StandardMaterial(`wallBugStripeMat_${id}`, scene);
    const stripeColor = VISUAL_JUICE_CONFIG.WALL_BUG_COLORS.BLUE_STRIPE;
    stripeMat.emissiveColor = new BABYLON.Color3(stripeColor.r, stripeColor.g, stripeColor.b);
    stripeMat.disableLighting = true;

    for (let i = 0; i < 5; i++) {
      const ring = BABYLON.MeshBuilder.CreateTorus(
        `ring_${id}_${i}`,
        { diameter: 1.22, thickness: 0.11, tessellation: 10 },
        scene
      );
      ring.position.y = -2.6 + i * 1.3;
      ring.rotation.x = Math.PI / 2;
      ring.material = stripeMat;
      ring.parent = bugRoot;
    }

    const eyeL = BABYLON.MeshBuilder.CreateSphere(`eyeL_${id}`, { diameter: 0.18 }, scene);
    eyeL.position.set(-0.25, -3.1, -0.42);
    eyeL.material = eyeMaterial;
    eyeL.parent = bugRoot;

    const eyeR = BABYLON.MeshBuilder.CreateSphere(`eyeR_${id}`, { diameter: 0.18 }, scene);
    eyeR.position.set(0.25, -3.1, -0.42);
    eyeR.material = eyeMaterial;
    eyeR.parent = bugRoot;

    const spikeMat = new BABYLON.StandardMaterial(`wallBugSpikeMat_${id}`, scene);
    const spikeColor = VISUAL_JUICE_CONFIG.WALL_BUG_COLORS.SPIKE_RED;
    spikeMat.emissiveColor = new BABYLON.Color3(spikeColor.r, spikeColor.g, spikeColor.b);
    spikeMat.disableLighting = true;

    const leftSpikes = new BABYLON.TransformNode("left_spikes", scene);
    leftSpikes.parent = bugRoot;

    const rightSpikes = new BABYLON.TransformNode("right_spikes", scene);
    rightSpikes.parent = bugRoot;

    for (let s = 0; s < 11; s++) {
      const spikeY = -3.0 + s * 0.6;

      const spikeL = BABYLON.MeshBuilder.CreateCylinder(
        `spikeL_${id}_${s}`,
        {
          height: 1.1,
          diameterTop: 0.0,
          diameterBottom: 0.38,
          tessellation: 6
        },
        scene
      );
      spikeL.position.set(-0.95, spikeY, 0);
      spikeL.rotation.z = Math.PI / 2;
      spikeL.material = spikeMat;
      spikeL.parent = leftSpikes;

      const spikeR = BABYLON.MeshBuilder.CreateCylinder(
        `spikeR_${id}_${s}`,
        {
          height: 1.1,
          diameterTop: 0.0,
          diameterBottom: 0.38,
          tessellation: 6
        },
        scene
      );
      spikeR.position.set(0.95, spikeY, 0);
      spikeR.rotation.z = -Math.PI / 2;
      spikeR.material = spikeMat;
      spikeR.parent = rightSpikes;
    }

    const leftSafety = new BABYLON.TransformNode("left_safety", scene);
    leftSafety.parent = bugRoot;

    const rightSafety = new BABYLON.TransformNode("right_safety", scene);
    rightSafety.parent = bugRoot;

    const stripL = BABYLON.MeshBuilder.CreateBox(
      `stripL_${id}`,
      {
        width: 0.12,
        height: 6.2,
        depth: 0.3
      },
      scene
    );
    stripL.position.set(-0.59, 0, 0);
    stripL.material = stripeMat;
    stripL.parent = leftSafety;

    const stripR = BABYLON.MeshBuilder.CreateBox(
      `stripR_${id}`,
      {
        width: 0.12,
        height: 6.2,
        depth: 0.3
      },
      scene
    );
    stripR.position.set(0.59, 0, 0);
    stripR.material = stripeMat;
    stripR.parent = rightSafety;

    for (let leg = 0; leg < 4; leg++) {
      const legY = -2.0 + leg * 1.35;

      const jointL = new BABYLON.TransformNode(`leg_joint_left_${id}_${leg}`, scene);
      jointL.position.set(-0.45, legY, 0);
      jointL.parent = bugRoot;

      const coxaL = BABYLON.MeshBuilder.CreateCylinder(
        `coxaL_${id}_${leg}`,
        { height: 0.7, diameterTop: 0.11, diameterBottom: 0.08, tessellation: 6 },
        scene
      );
      coxaL.position.set(-0.35, 0, 0);
      coxaL.rotation.z = Math.PI / 2;
      coxaL.material = bugMaterial;
      coxaL.parent = jointL;

      const tibiaJointL = new BABYLON.TransformNode(`tibia_joint_left_${id}_${leg}`, scene);
      tibiaJointL.position.set(-0.7, 0, 0);
      tibiaJointL.rotation.z = Math.PI / 4;
      tibiaJointL.parent = jointL;

      const tibiaL = BABYLON.MeshBuilder.CreateCylinder(
        `tibiaL_${id}_${leg}`,
        { height: 0.6, diameterTop: 0.08, diameterBottom: 0.05, tessellation: 6 },
        scene
      );
      tibiaL.position.set(0, -0.3, 0);
      tibiaL.material = bugMaterial;
      tibiaL.parent = tibiaJointL;

      const footL = BABYLON.MeshBuilder.CreateSphere(
        `footL_${id}_${leg}`,
        { diameterX: 0.14, diameterY: 0.18, diameterZ: 0.14 },
        scene
      );
      footL.position.set(0, -0.6, 0);
      footL.material = eyeMaterial;
      footL.parent = tibiaJointL;

      const jointR = new BABYLON.TransformNode(`leg_joint_right_${id}_${leg}`, scene);
      jointR.position.set(0.45, legY, 0);
      jointR.parent = bugRoot;

      const coxaR = BABYLON.MeshBuilder.CreateCylinder(
        `coxaR_${id}_${leg}`,
        { height: 0.7, diameterTop: 0.11, diameterBottom: 0.08, tessellation: 6 },
        scene
      );
      coxaR.position.set(0.35, 0, 0);
      coxaR.rotation.z = -Math.PI / 2;
      coxaR.material = bugMaterial;
      coxaR.parent = jointR;

      const tibiaJointR = new BABYLON.TransformNode(`tibia_joint_right_${id}_${leg}`, scene);
      tibiaJointR.position.set(0.7, 0, 0);
      tibiaJointR.rotation.z = -Math.PI / 4;
      tibiaJointR.parent = jointR;

      const tibiaR = BABYLON.MeshBuilder.CreateCylinder(
        `tibiaR_${id}_${leg}`,
        { height: 0.6, diameterTop: 0.08, diameterBottom: 0.05, tessellation: 6 },
        scene
      );
      tibiaR.position.set(0, -0.3, 0);
      tibiaR.material = bugMaterial;
      tibiaR.parent = tibiaJointR;

      const footR = BABYLON.MeshBuilder.CreateSphere(
        `footR_${id}_${leg}`,
        { diameterX: 0.14, diameterY: 0.18, diameterZ: 0.14 },
        scene
      );
      footR.position.set(0, -0.6, 0);
      footR.material = eyeMaterial;
      footR.parent = tibiaJointR;
    }

    return bugRoot;
  }
}
