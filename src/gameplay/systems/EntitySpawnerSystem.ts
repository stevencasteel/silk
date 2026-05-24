import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { EcsWorld } from "../../core/ecs/EcsWorld";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
  TransformComponent,
  KinematicVelocityComponent,
  KinematicTargetComponent,
  SilkComponent,
  HealthComponent,
  InputIntentComponent,
  WeaverAIComponent,
  PlayerTag,
  WeaverTag,
  TraversalStateComponent,
  InvulnerabilityComponent,
  WeaverTraversalComponent
} from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { ARENA_CONFIG, GAMEPLAY_TUNING, VISUAL_JUICE_CONFIG } from "../../core/engine/ArenaConfig";
import * as BABYLON from "@babylonjs/core";

const HASH = String.fromCharCode(35);

export class EntitySpawnerSystem implements ISystem {
  readonly phase = SystemPhase.Intents;
  readonly initPhase = InitPhase.World;

  constructor(
    private refs: EntityRefs,
    private entities: EcsWorld,
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
      x: 0,
      y: ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y,
      z: 0,
      qx: 0,
      qy: 0,
      qz: 0,
      qw: 1,
      prevX: 0,
      prevY: ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y - 6.0,
      prevZ: 0,
      prevQx: 0,
      prevQy: 0,
      prevQz: 0,
      prevQw: 1
    });
    this.velocities.add(weaverId, { x: 4.5, y: 0, z: 0 });
    this.targets.add(weaverId, { x: 0, y: ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y, z: 0, active: true });
    this.weaverAIs.add(weaverId, { state: "SWEEPING", timeInState: 0, hue: HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.SWEEPING, scrollSpeed: ARENA_CONFIG.SCROLL_SPEED.BASE });
    this.healths.add(weaverId, { current: 100, max: 100 });
    this.weaverTags.add(weaverId, {});
    this.weaverTraversal.add(weaverId, {
      velX: 4.5,
      velY: 0,
      isGrounded: false,
      isWallClinging: false,
      wallNormalX: 0
    });
    this.refs.weaver = weaverId;

    const wMesh = BABYLON.MeshBuilder.CreateIcoSphere(
      "weaverVisual",
      { radius: ARENA_CONFIG.ENTITY.WEAVER_RADIUS, subdivisions: 3 },
      scene
    );
    const wMat = new BABYLON.PBRMaterial("weaverMat", scene);
    wMat.albedoColor = new BABYLON.Color3(0.15, 0.15, 0.18);
    wMat.metallic = VISUAL_JUICE_CONFIG.MATERIALS.WEAVER.METALLIC;
    wMat.roughness = VISUAL_JUICE_CONFIG.MATERIALS.WEAVER.ROUGHNESS;
    wMat.clearCoat.isEnabled = true;
    wMat.clearCoat.intensity = VISUAL_JUICE_CONFIG.MATERIALS.WEAVER.CLEAR_COAT_INTENSITY;
    wMat.clearCoat.roughness = VISUAL_JUICE_CONFIG.MATERIALS.WEAVER.CLEAR_COAT_ROUGHNESS;
    wMesh.material = wMat;
    this.visualRegistry.registerTransformNode(weaverId, wMesh);

    const playerId = this.entities.create();
    this.transforms.add(playerId, {
      x: 0,
      y: ARENA_CONFIG.VERTICAL.PLAYER_SPAWN_Y,
      z: 0,
      qx: 0,
      qy: 0,
      qz: 0,
      qw: 1,
      prevX: 0,
      prevY: ARENA_CONFIG.VERTICAL.PLAYER_SPAWN_Y,
      prevZ: 0,
      prevQx: 0,
      prevQy: 0,
      prevQz: 0,
      prevQw: 1
    });
    this.velocities.add(playerId, { x: 0, y: 0, z: 0 });
    this.targets.add(playerId, { x: 0, y: ARENA_CONFIG.VERTICAL.PLAYER_SPAWN_Y, z: 0, active: true });
    this.silks.add(playerId, {
      anchorX: 0,
      anchorY: ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y,
      anchorZ: 0,
      maxLength: ARENA_CONFIG.SILK.INITIAL_LENGTH,
      currentLength: ARENA_CONFIG.SILK.INITIAL_LENGTH,
      isAttached: true,
      tension: 0.0,
      dynamicVelX: 0.0,
      dynamicVelY: 0.0
    });
    this.healths.add(playerId, { current: GAMEPLAY_TUNING.PLAYER.MAX_INTEGRITY, max: GAMEPLAY_TUNING.PLAYER.MAX_INTEGRITY });
    this.inputs.add(playerId, { x: 0, y: 0, jump: false });
    this.playerTags.add(playerId, {});
    this.traversal.add(playerId, {
      state: "AIRBORNE",
      wallNormalX: 0,
      wallNormalY: 0,
      wallDir: 0,
      launchTimer: 0.0,
      launchPower: 0.0
    });
    this.iframes.add(playerId, { timeRemaining: 0 });
    this.refs.player = playerId;

    const pMesh = BABYLON.MeshBuilder.CreateCapsule(
      "playerVisual",
      { height: ARENA_CONFIG.ENTITY.PLAYER_HEIGHT, radius: ARENA_CONFIG.ENTITY.PLAYER_RADIUS, subdivisions: 3 },
      scene
    );
    const pMat = new BABYLON.PBRMaterial("playerMat", scene);
    pMat.albedoColor = new BABYLON.Color3(0.88, 0.9, 0.92);
    pMat.metallic = VISUAL_JUICE_CONFIG.MATERIALS.PLAYER.METALLIC;
    pMat.roughness = VISUAL_JUICE_CONFIG.MATERIALS.PLAYER.ROUGHNESS;
    pMat.sheen.isEnabled = true;
    pMat.sheen.intensity = VISUAL_JUICE_CONFIG.MATERIALS.PLAYER.SHEEN_INTENSITY;
    pMat.sheen.roughness = VISUAL_JUICE_CONFIG.MATERIALS.PLAYER.SHEEN_ROUGHNESS;
    pMat.sheen.color = new BABYLON.Color3(0.95, 0.95, 1.0);
    pMesh.material = pMat;
    this.visualRegistry.registerTransformNode(playerId, pMesh);
  }
}
