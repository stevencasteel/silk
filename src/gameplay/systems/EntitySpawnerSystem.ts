import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { EntityRegistry } from "../../core/ecs/Entity";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { 
    TransformComponent, 
    KinematicVelocityComponent, 
    KinematicTargetComponent, 
    TetherComponent, 
    HealthComponent, 
    InputIntentComponent, 
    SpiderAIComponent, 
    PlayerStatsComponent, 
    PlayerTag, 
    SpiderTag, 
    AnchorTag, 
    TraversalStateComponent, 
    InvulnerabilityComponent, 
    SpiderTraversalComponent 
} from "../../core/ecs/Components";
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
        private spiderAIs: ComponentStore<SpiderAIComponent>,
        private playerStats: ComponentStore<PlayerStatsComponent>,
        private playerTags: ComponentStore<PlayerTag>,
        private spiderTags: ComponentStore<SpiderTag>,
        private anchorTags: ComponentStore<AnchorTag>,
        private visualRegistry: IVisualRegistry,
        private traversal: ComponentStore<TraversalStateComponent>,
        private iframes: ComponentStore<InvulnerabilityComponent>,
        private spiderTraversal: ComponentStore<SpiderTraversalComponent>
    ) {}

    public init(): void {
        const scene = this.visualRegistry.getScene();
        if (!scene) return;

        const anchorId = this.entities.create();
        this.transforms.add(anchorId, {
            x: 0, y: 27.2, z: 0,
            qx: 0, qy: 0, qz: 0, qw: 1,
            prevX: 0, prevY: 27.2, prevZ: 0,
            prevQx: 0, prevQy: 0, prevQz: 0, prevQw: 1
        });
        this.anchorTags.add(anchorId, {});
        this.refs.anchor = anchorId;
        const anchorMesh = BABYLON.MeshBuilder.CreateCylinder("anchorVisual", { height: 0.3, diameter: 0.5 }, scene);
        const anchorMat = new BABYLON.StandardMaterial("anchorMat", scene);
        anchorMat.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        anchorMesh.material = anchorMat;
        this.visualRegistry.registerTransformNode(anchorId, anchorMesh);

        const spiderId = this.entities.create();
        this.transforms.add(spiderId, {
            x: 0, y: 27.2, z: 0,
            qx: 0, qy: 0, qz: 0, qw: 1,
            prevX: 0, prevY: 27.2, prevZ: 0,
            prevQx: 0, prevQy: 0, prevQz: 0, prevQw: 1
        });
        this.velocities.add(spiderId, { x: 4.5, y: 0, z: 0 });
        this.targets.add(spiderId, { x: 0, y: 27.2, z: 0, active: true });
        this.spiderAIs.add(spiderId, { state: "SWEEPING", timeInState: 0, targetX: 0, targetY: 27.2, hue: "#ef4444", hasFakedDeath: false });
        this.healths.add(spiderId, { current: 100, max: 100 });
        this.spiderTags.add(spiderId, {});
        this.spiderTraversal.add(spiderId, { velX: 4.5, velY: 0, isGrounded: false, isWallClinging: false, wallNormalX: 0 });
        this.refs.spider = spiderId;
        const sMesh = BABYLON.MeshBuilder.CreateIcoSphere("spiderVisual", { radius: 2.4, subdivisions: 3 }, scene);
        const sMat = new BABYLON.StandardMaterial("spiderMat", scene);
        sMat.diffuseColor = new BABYLON.Color3(0.95, 0.1, 0.1);
        sMat.emissiveColor = new BABYLON.Color3(0.4, 0.02, 0.02);
        sMesh.material = sMat;
        this.visualRegistry.registerTransformNode(spiderId, sMesh);

        const playerId = this.entities.create();
        this.transforms.add(playerId, {
            x: 0, y: 15.2, z: 0,
            qx: 0, qy: 0, qz: 0, qw: 1,
            prevX: 0, prevY: 15.2, prevZ: 0,
            prevQx: 0, prevQy: 0, prevQz: 0, prevQw: 1
        });
        this.velocities.add(playerId, { x: 0, y: 0, z: 0 });
        this.targets.add(playerId, { x: 0, y: 15.2, z: 0, active: true });
        this.tethers.add(playerId, {
            anchorX: 0, anchorY: 27.2, anchorZ: 0,
            maxLength: 12.0, currentLength: 12.0,
            isAttached: true, tension: 0.0,
            dynamicVelX: 0.0, dynamicVelY: 0.0
        });
        this.healths.add(playerId, { current: 5, max: 5 });
        this.inputs.add(playerId, { x: 0, y: 0, jump: false, fire: false, detach: false });
        this.playerStats.add(playerId, { moveSpeed: 10, climbSpeed: 4, swingForce: 32, minRope: 4, maxRope: 24 });
        this.playerTags.add(playerId, {});
        this.traversal.add(playerId, { state: "AIRBORNE", wallNormalX: 0, wallNormalY: 0, wallDir: 0, launchTimer: 0.0, launchPower: 0.0 });
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
