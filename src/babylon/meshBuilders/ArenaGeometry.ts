import * as BABYLON from "@babylonjs/core";

export class ArenaGeometry {
    constructor(private scene: BABYLON.Scene) {}

    public generateElevatorShaft(): void {
        const wallMaterial = new BABYLON.StandardMaterial("wallMat", this.scene);
        wallMaterial.diffuseColor = new BABYLON.Color3(0.06, 0.07, 0.09);
        wallMaterial.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);

        const metalMaterial = new BABYLON.StandardMaterial("metalMat", this.scene);
        metalMaterial.diffuseColor = new BABYLON.Color3(0.12, 0.13, 0.15);
        metalMaterial.specularColor = new BABYLON.Color3(0.35, 0.35, 0.35);

        const neonBlueMat = new BABYLON.StandardMaterial("neonBlueMat", this.scene);
        neonBlueMat.emissiveColor = new BABYLON.Color3(0.0, 0.45, 0.95);
        neonBlueMat.disableLighting = true;

        const leftWall = BABYLON.MeshBuilder.CreateBox("leftWall", { width: 2, height: 32, depth: 4 }, this.scene);
        leftWall.position.set(-16, 15, 0);
        leftWall.material = wallMaterial;

        const rightWall = BABYLON.MeshBuilder.CreateBox("rightWall", { width: 2, height: 32, depth: 4 }, this.scene);
        rightWall.position.set(16, 15, 0);
        rightWall.material = wallMaterial;

        const floor = BABYLON.MeshBuilder.CreateBox("floorBlock", { width: 34, height: 2, depth: 4 }, this.scene);
        floor.position.set(0, -1, 0);
        floor.material = wallMaterial;

        const ceiling = BABYLON.MeshBuilder.CreateBox("ceilingBlock", { width: 34, height: 2, depth: 4 }, this.scene);
        ceiling.position.set(0, 29, 0);
        ceiling.material = wallMaterial;

        const leftPlatform = BABYLON.MeshBuilder.CreateBox("leftPlatform", { width: 8, height: 1, depth: 3 }, this.scene);
        leftPlatform.position.set(-11, 12, 0);
        leftPlatform.material = metalMaterial;

        const rightPlatform = BABYLON.MeshBuilder.CreateBox("rightPlatform", { width: 8, height: 1, depth: 3 }, this.scene);
        rightPlatform.position.set(11, 18, 0);
        rightPlatform.material = metalMaterial;

        for (let y = 3; y <= 27; y += 6) {
            const leftStrut = BABYLON.MeshBuilder.CreateBox("strutLeft_" + y, { width: 0.3, height: 0.3, depth: 4.2 }, this.scene);
            leftStrut.position.set(-14.9, y, 0);
            leftStrut.material = neonBlueMat;

            const rightStrut = BABYLON.MeshBuilder.CreateBox("strutRight_" + y, { width: 0.3, height: 0.3, depth: 4.2 }, this.scene);
            rightStrut.position.set(14.9, y, 0);
            rightStrut.material = neonBlueMat;
        }
    }
}
