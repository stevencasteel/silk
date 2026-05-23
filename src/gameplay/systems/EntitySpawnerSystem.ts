import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { EntityRegistry } from "../../core/ecs/Entity";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent, KinematicVelocityComponent, KinematicTargetComponent, TetherComponent, HealthComponent, InputIntentComponent, WardenAIComponent, PlayerStatsComponent, PlayerTag, WardenTag, AnchorTag, TraversalStateComponent, InvulnerabilityComponent, WardenTraversalComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import * as BABYLON from "@babylonjs/core";

export class EntitySpawnerSystem implements ISystem {
    readonly phase = SystemPhase.Intents;
    readonly initPhase = InitPhase.World;

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
        private visualRegistry: IVisualRegistry,
        private traversal: ComponentStore<TraversalStateComponent>,
        private iframes: ComponentStore<InvulnerabilityComponent>,
        private wardenTraversal: ComponentStore<WardenTraversalComponent>
    ) {}

    public init(): void {
        const scene = this.visualRegistry.getScene();
        if (!scene) return;

        const anchorId = this.entities.create();
        this.transforms.add(anchorId, {
            x: 0, y: 26, z: 0,
            qx: 0, qy: 0, qz: 0, qw: 1,
            prevX: 0, prevY: 26, prevZ: 0,
            prevQx: 0, prevQy: 0, prevQz: 0, prevQw: 1
        });
        this.anchorTags.add(anchorId, {});
        this.refs.anchor = anchorId;
        const anchorMesh = BABYLON.MeshBuilder.CreateCylinder("anchorVisual", { height: 0.3, diameter: 0.5 }, scene);
        const anchorMat = new BABYLON.StandardMaterial("anchorMat", scene);
        anchorMat.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        anchorMesh.material = anchorMat;
        this.visualRegistry.registerTransformNode(anchorId, anchorMesh);

        const wardenId = this.entities.create();
        this.transforms.add(wardenId, {
            x: 0, y: 26, z: 0,
            qx: 0, qy: 0, qz: 0, qw: 1,
            prevX: 0, prevY: 26, prevZ: 0,
            prevQx: 0, prevQy: 0, prevQz: 0, prevQw: 1
        });
        this.velocities.add(wardenId, { x: 4.5, y: 0, z: 0 });
        this.targets.add(wardenId, { x: 0, y: 26, z: 0, active: true });
        this.wardenAIs.add(wardenId, { state: "SWEEPING", timeInState: 0, targetX: 0, targetY: 26, hue: "#ef4444", hasFakedDeath: false });
        this.healths.add(wardenId, { current: 100, max: 100 });
        this.wardenTags.add(wardenId, {});
        this.wardenTraversal.add(wardenId, { velX: 4.5, velY: 0, isGrounded: false, isWallClinging: false, wallNormalX: 0 });
        this.refs.warden = wardenId;
        const wMesh = BABYLON.MeshBuilder.CreateIcoSphere("wardenVisual", { radius: 2.4, subdivisions: 3 }, scene);
        const wMat = new BABYLON.StandardMaterial("wardenMat", scene);
        wMat.diffuseColor = new BABYLON.Color3(0.95, 0.1, 0.1);
        wMat.emissiveColor = new BABYLON.Color3(0.4, 0.02, 0.02);
        wMesh.material = wMat;
        this.visualRegistry.registerTransformNode(wardenId, wMesh);

        const playerId = this.entities.create();
        this.transforms.add(playerId, {
            x: 0, y: 16, z: 0,
            qx: 0, qy: 0, qz: 0, qw: 1,
            prevX: 0, prevY: 16, prevZ: 0,
            prevQx: 0, prevQy: 0, prevQz: 0, prevQw: 1
        });
        this.velocities.add(playerId, { x: 0, y: 0, z: 0 });
        this.targets.add(playerId, { x: 0, y: 16, z: 0, active: true });
        this.tethers.add(playerId, {
            anchorX: 0, anchorY: 26, anchorZ: 0,
            maxLength: 10.0, currentLength: 10.0,
            isAttached: true, tension: 0.0,
            dynamicVelX: 0.0, dynamicVelY: 0.0
        });
        this.healths.add(playerId, { current: 5, max: 5 });
        this.inputs.add(playerId, { x: 0, y: 0, jump: false, fire: false, detach: false });
        this.playerStats.add(playerId, { moveSpeed: 10, climbSpeed: 4, swingForce: 28, minRope: 4, maxRope: 20 });
        this.playerTags.add(playerId, {});
        this.traversal.add(playerId, { 
            state: "AIRBORNE", 
            wallNormalX: 0, 
            wallNormalY: 0, 
            charge: 0.0,
            launchTimer: 0.0,
            launchPower: 0.0
        });
        this.iframes.add(playerId, { timeRemaining: 0 });
        this.refs.player = playerId;
        const pMesh = BABYLON.MeshBuilder.CreateCapsule("playerVisual", { height: 1.8, radius: 0.4, subdivisions: 3 }, scene);
        const pMat = new BABYLON.StandardMaterial("playerMat", scene);
        pMat.diffuseColor = new BABYLON.Color3(0.13, 0.77, 0.36);
        pMat.emissiveColor = new BABYLON.Color3(0.01, 0.08, 0.01);
        pMesh.material = pMat;
        this.visualRegistry.registerTransformNode(playerId, pMesh);
    }

    public update(_dt: number): void {
        void _dt;
    }
}
