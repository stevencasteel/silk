import { ISystem } from "../../contracts/ISystem";
import { EntityRegistry } from "../../core/ecs/Entity";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent, KinematicVelocityComponent, KinematicTargetComponent, TetherComponent, HealthComponent, InputIntentComponent, WardenAIComponent, PlayerStatsComponent, PlayerTag, WardenTag, AnchorTag } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import * as BABYLON from "@babylonjs/core";

export class EntitySpawnerSystem implements ISystem {
    constructor(
        private refs: EntityRefs,
        private entities: EntityRegistry,
        private transforms: ComponentStore<TransformComponent>,
        private velocities: ComponentStore<KinematicVelocityComponent>,
        private targets: ComponentStore<KinematicTargetComponent>,
        private tethers: ComponentStore<TetherComponent>,
        private healths: ComponentStore<HealthComponent>,
        private inputs: ComponentStore<InputIntentComponent>,
        private wardenAIs: ComponentStore<WardenAIComponent>,
        private playerStats: ComponentStore<PlayerStatsComponent>,
        private playerTags: ComponentStore<PlayerTag>,
        private wardenTags: ComponentStore<WardenTag>,
        private anchorTags: ComponentStore<AnchorTag>,
        private visualRegistry: IVisualRegistry
    ) {}

    public init(): void {
        const scene = this.visualRegistry.getScene();
        if (!scene) return;

        this.refs.anchor = this.entities.create();
        this.transforms.add(this.refs.anchor, { x: 0, y: 22, z: 0, qx: 0, qy: 0, qz: 0, qw: 1, prevX: 0, prevY: 22, prevZ: 0, prevQx: 0, prevQy: 0, prevQz: 0, prevQw: 1 });
        this.anchorTags.add(this.refs.anchor, {});

        this.refs.player = this.entities.create();
        this.transforms.add(this.refs.player, { x: 0, y: 10, z: 0, qx: 0, qy: 0, qz: 0, qw: 1, prevX: 0, prevY: 10, prevZ: 0, prevQx: 0, prevQy: 0, prevQz: 0, prevQw: 1 });
        this.velocities.add(this.refs.player, { x: 0, y: 0, z: 0 });
        this.targets.add(this.refs.player, { x: 0, y: 10, z: 0, active: true });
        this.tethers.add(this.refs.player, { anchorX: 0, anchorY: 22, anchorZ: 0, maxLength: 12, currentLength: 12, isAttached: true, tension: 0, dynamicVelX: 0, dynamicVelY: 0 });
        this.healths.add(this.refs.player, { current: 5, max: 5 });
        this.inputs.add(this.refs.player, { x: 0, y: 0, jump: false, fire: false });
        this.playerStats.add(this.refs.player, { moveSpeed: 10, climbSpeed: 5, swingForce: 20, minRope: 4, maxRope: 20 });
        this.playerTags.add(this.refs.player, {});
        
        const pMesh = BABYLON.MeshBuilder.CreateBox("playerVisual", { width: 1, height: 2, depth: 1 }, scene);
        const pMat = new BABYLON.StandardMaterial("playerMat", scene);
        pMat.diffuseColor = new BABYLON.Color3(0.13, 0.77, 0.36);
        pMat.emissiveColor = new BABYLON.Color3(0.05, 0.15, 0.05);
        pMesh.material = pMat;
        this.visualRegistry.registerTransformNode(this.refs.player, pMesh);

        this.refs.warden = this.entities.create();
        this.transforms.add(this.refs.warden, { x: 5, y: 5, z: 0, qx: 0, qy: 0, qz: 0, qw: 1, prevX: 5, prevY: 5, prevZ: 0, prevQx: 0, prevQy: 0, prevQz: 0, prevQw: 1 });
        this.velocities.add(this.refs.warden, { x: 0, y: 0, z: 0 });
        this.wardenAIs.add(this.refs.warden, { state: "DORMANT", timeInState: 0, targetX: 0, targetY: 0, hue: "#4b5563" });
        this.healths.add(this.refs.warden, { current: 100, max: 100 });
        this.wardenTags.add(this.refs.warden, {});

        const wMesh = BABYLON.MeshBuilder.CreateBox("wardenVisual", { width: 2, height: 2, depth: 2 }, scene);
        const wMat = new BABYLON.StandardMaterial("wardenMat", scene);
        wMat.diffuseColor = new BABYLON.Color3(0.93, 0.22, 0.22);
        wMesh.material = wMat;
        this.visualRegistry.registerTransformNode(this.refs.warden, wMesh);
    }
    public update(dt: number): void {}
}
