import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { EntityRegistry } from "../../core/ecs/Entity";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent, KinematicVelocityComponent, KinematicTargetComponent, SilkComponent, HealthComponent, InputIntentComponent, WeaverAIComponent, PlayerTag, WeaverTag, TraversalStateComponent, InvulnerabilityComponent, WeaverTraversalComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import * as BABYLON from "@babylonjs/core";

const HASH = String.fromCharCode(35);

export class EntitySpawnerSystem implements ISystem {
readonly phase = SystemPhase.Intents;
readonly initPhase = InitPhase.World;

constructor(
private refs: EntityRefs,
private entities: EntityRegistry,
private transforms: ComponentStore<TransformComponent>,
private velocities: ComponentStore<KinematicVelocityComponent>,
private targets: ComponentStore<KinematicTargetComponent>,
private silks: ComponentStore<SilkComponent>,
private healths: ComponentStore<HealthComponent>,
private inputs: ComponentStore<InputIntentComponent>,
private weaverAIs: ComponentStore<WeaverAIComponent>,
private playerTags: ComponentStore<PlayerTag>,
private weaverTags: ComponentStore<WeaverTag>,
private visualRegistry: IVisualRegistry,
private traversal: ComponentStore<TraversalStateComponent>,
private iframes: ComponentStore<InvulnerabilityComponent>,
private weaverTraversal: ComponentStore<WeaverTraversalComponent>
) {}

public init(): void {
const scene = this.visualRegistry.getScene();
if (!scene) return;

const weaverId = this.entities.create();
this.transforms.add(weaverId, {
x: 0, y: 34.0, z: 0,
qx: 0, qy: 0, qz: 0, qw: 1,
prevX: 0, prevY: 28.0, prevZ: 0,
prevQx: 0, prevQy: 0, prevQz: 0, prevQw: 1
});
this.velocities.add(weaverId, { x: 4.5, y: 0, z: 0 });
this.targets.add(weaverId, { x: 0, y: 34.0, z: 0, active: true });
this.weaverAIs.add(weaverId, { state: "SWEEPING", timeInState: 0, hue: HASH + "ef4444" });
this.healths.add(weaverId, { current: 100, max: 100 });
this.weaverTags.add(weaverId, {});
this.weaverTraversal.add(weaverId, { velX: 4.5, velY: 0, isGrounded: false, isWallClinging: false, wallNormalX: 0 });
this.refs.weaver = weaverId;

const wMesh = BABYLON.MeshBuilder.CreateIcoSphere("weaverVisual", { radius: 2.2, subdivisions: 3 }, scene);
const wMat = new BABYLON.PBRMaterial("weaverMat", scene);
wMat.albedoColor = new BABYLON.Color3(0.15, 0.15, 0.18);
wMat.metallic = 0.3;
wMat.roughness = 0.5;
wMat.clearCoat.isEnabled = true;
wMat.clearCoat.intensity = 0.4;
wMat.clearCoat.roughness = 0.2;
wMesh.material = wMat;
this.visualRegistry.registerTransformNode(weaverId, wMesh);

const playerId = this.entities.create();
this.transforms.add(playerId, {
x: 0, y: 10.0, z: 0,
qx: 0, qy: 0, qz: 0, qw: 1,
prevX: 0, prevY: 10.0, prevZ: 0,
prevQx: 0, prevQy: 0, prevQz: 0, prevQw: 1
});
this.velocities.add(playerId, { x: 0, y: 0, z: 0 });
this.targets.add(playerId, { x: 0, y: 10.0, z: 0, active: true });
this.silks.add(playerId, {
anchorX: 0, anchorY: 34.0, anchorZ: 0,
maxLength: 12.0, currentLength: 12.0,
isAttached: true, tension: 0.0,
dynamicVelX: 0.0, dynamicVelY: 0.0
});
this.healths.add(playerId, { current: 5, max: 5 });
this.inputs.add(playerId, { x: 0, y: 0, jump: false });
this.playerTags.add(playerId, {});
this.traversal.add(playerId, { state: "AIRBORNE", wallNormalX: 0, wallNormalY: 0, wallDir: 0, launchTimer: 0.0, launchPower: 0.0 });
this.iframes.add(playerId, { timeRemaining: 0 });
this.refs.player = playerId;

const pMesh = BABYLON.MeshBuilder.CreateCapsule("playerVisual", { height: 1.8, radius: 0.4, subdivisions: 3 }, scene);
const pMat = new BABYLON.PBRMaterial("playerMat", scene);
pMat.albedoColor = new BABYLON.Color3(0.88, 0.90, 0.92);
pMat.metallic = 0.0;
pMat.roughness = 0.85;
pMat.sheen.isEnabled = true;
pMat.sheen.intensity = 0.5;
pMat.sheen.roughness = 0.4;
pMat.sheen.color = new BABYLON.Color3(0.95, 0.95, 1.0);
pMesh.material = pMat;
this.visualRegistry.registerTransformNode(playerId, pMesh);
}
}
