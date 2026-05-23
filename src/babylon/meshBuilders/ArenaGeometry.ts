import * as BABYLON from "@babylonjs/core";

export class ArenaGeometry {
    constructor(private scene: BABYLON.Scene) {}

    public generateElevatorShaft(): void {
        const wallMaterial = new BABYLON.StandardMaterial("wallMat", this.scene);
        wallMaterial.diffuseColor = new BABYLON.Color3(0.07, 0.08, 0.11);
        wallMaterial.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);

        // Smooth left and right solid walls (boundaries at X = -15 and X = 15)
        const leftWall = BABYLON.MeshBuilder.CreateBox("leftWall", { width: 2, height: 40, depth: 4 }, this.scene);
        leftWall.position.set(-16, 14, 0);
        leftWall.material = wallMaterial;

        const rightWall = BABYLON.MeshBuilder.CreateBox("rightWall", { width: 2, height: 40, depth: 4 }, this.scene);
        rightWall.position.set(16, 14, 0);
        rightWall.material = wallMaterial;

        // Generate unit measurement ticks at regular height intervals
        const tickMat = new BABYLON.StandardMaterial("tickMat", this.scene);
        tickMat.emissiveColor = new BABYLON.Color3(0.2, 0.5, 0.85);
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
