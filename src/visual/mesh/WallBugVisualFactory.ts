import * as BABYLON from "@babylonjs/core";

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

    for (let i = 0; i < 5; i++) {
      const ring = BABYLON.MeshBuilder.CreateTorus(
        `ring_${id}_${i}`,
        { diameter: 1.2, thickness: 0.1, tessellation: 8 },
        scene
      );
      ring.position.y = -2.6 + i * 1.3;
      ring.rotation.x = Math.PI / 2;
      ring.material = bugMaterial;
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
