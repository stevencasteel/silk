import * as BABYLON from "@babylonjs/core";
import { VISUAL_JUICE_CONFIG } from "../../core/engine/ArenaConfig";

export class WallBugVisualFactory {
  public static buildBugMeshHierarchy(
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

    // High Density Spikes: Fit 11 spikes tightly on each dangerous side
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

    // Split Vertically down the middle design language: Blue safety indicator strips
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
