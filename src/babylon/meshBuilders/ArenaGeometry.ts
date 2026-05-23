import * as BABYLON from "@babylonjs/core";

export class ArenaGeometry {
    constructor(private scene: BABYLON.Scene) {}

    public generateElevatorShaft(): void {
        const wallMaterial = new BABYLON.PBRMaterial("wallMat", this.scene);
        wallMaterial.albedoColor = new BABYLON.Color3(0.05, 0.06, 0.08);
        wallMaterial.metallic = 0.4;
        wallMaterial.roughness = 0.6; 

        const leftWall = BABYLON.MeshBuilder.CreateBox("leftWall", { width: 2, height: 40, depth: 4 }, this.scene);
        leftWall.position.set(-16, 14, 0);
        leftWall.material = wallMaterial;

        const rightWall = BABYLON.MeshBuilder.CreateBox("rightWall", { width: 2, height: 40, depth: 4 }, this.scene);
        rightWall.position.set(16, 14, 0);
        rightWall.material = wallMaterial;

        const tickMat = new BABYLON.PBRMaterial("tickMat", this.scene);
        tickMat.albedoColor = new BABYLON.Color3(0.0, 0.0, 0.0);
        tickMat.emissiveColor = new BABYLON.Color3(0.13, 0.77, 0.36);
        tickMat.emissiveIntensity = 3.5; 
        tickMat.disableLighting = true;

        const tickCount = 18;
        for (let i = 0; i < tickCount; i++) {
            const leftTick = BABYLON.MeshBuilder.CreateBox(`leftTick_${i}`, { width: 0.35, height: 0.08, depth: 2.1 }, this.scene);
            leftTick.position.set(-14.9, i * 2.0, 0);
            leftTick.material = tickMat;
            leftTick.metadata = { type: "scrolling_tick", index: i, initialY: i * 2.0 };

            const rightTick = BABYLON.MeshBuilder.CreateBox(`rightTick_${i}`, { width: 0.35, height: 0.08, depth: 2.1 }, this.scene);
            rightTick.position.set(14.9, i * 2.0, 0);
            rightTick.material = tickMat;
            rightTick.metadata = { type: "scrolling_tick", index: i, initialY: i * 2.0 };
        }
    }
}
