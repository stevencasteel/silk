import { RasterShearPlugin } from "../visual/lighting/RasterShearPlugin";
import { ISystem } from "../contracts/ISystem";
import { SystemPhase, InitPhase } from "../contracts/SystemPhase";
import { EntityId } from "../core/ecs/Entity";
import { SystemContext } from "../core/engine/SystemContext";
import {
  TransformComponent,
  KinematicVelocityComponent,
  KinematicTargetComponent,
  TetherComponent,
  HealthComponent,
  InputIntentComponent,
  WeaverAIComponent,
  PlayerTag,
  WeaverTag,
  TraversalStateComponent,
  InvulnerabilityComponent,
  WeaverTraversalComponent
} from "../core/ecs/Components";
import { ARENA_CONFIG, GAMEPLAY_TUNING, VISUAL_JUICE_CONFIG } from "../core/engine/ArenaConfig";
import * as BABYLON from "@babylonjs/core";

export class EntitySpawnerSystem implements ISystem {
  readonly phase = SystemPhase.Intents;
  readonly initPhase = InitPhase.World;
  private sharedWeaverShape: BABYLON.PhysicsShapeSphere | null = null;
  private sharedPlayerShape: BABYLON.PhysicsShapeCapsule | null = null;

  constructor(private context: SystemContext) {}

  public init(): void {
    const scene = this.context.visualRegistry.getScene();
    if (scene && scene.isPhysicsEnabled()) {
      this.sharedWeaverShape = new BABYLON.PhysicsShapeSphere(BABYLON.Vector3.Zero(), ARENA_CONFIG.ENTITY.WEAVER_RADIUS, scene);
      const cylHalfHeight = (ARENA_CONFIG.ENTITY.PLAYER_HEIGHT - 2 * ARENA_CONFIG.ENTITY.PLAYER_RADIUS) / 2;
      this.sharedPlayerShape = new BABYLON.PhysicsShapeCapsule(new BABYLON.Vector3(0, -cylHalfHeight, 0), new BABYLON.Vector3(0, cylHalfHeight, 0), ARENA_CONFIG.ENTITY.PLAYER_RADIUS, scene);
    }
    this.spawnWeaver();
    this.spawnPlayer();
  }

  public spawnWeaver(existingId?: EntityId): EntityId {
    const scene = this.context.visualRegistry.getScene();
    if (!scene) return -1;

    const weaverId = existingId ?? this.context.world.create();
    this.context.world.clearEntityComponents(weaverId);

    this.context.visualRegistry.unregisterTransformNode(weaverId);

    this.context.stores.get<TransformComponent>("transform").add(weaverId, {
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
    
    this.context.stores.get<KinematicVelocityComponent>("velocity").add(weaverId, { x: 4.5, y: 0, z: 0 });
    this.context.stores.get<KinematicTargetComponent>("target").add(weaverId, { x: 0, y: ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y, z: 0, active: true });
    
    this.context.stores.get<WeaverAIComponent>("weaverAI").add(weaverId, {
      state: "SWEEPING",
      timeInState: 0,
      hue: String.fromCharCode(35) + VISUAL_JUICE_CONFIG.WEAVER_COLORS.SWEEPING,
      scrollSpeed: ARENA_CONFIG.SCROLL_SPEED.BASE,
      damageWarpIntensity: 0.0,
      damageWarpTime: 0.0
    });
    
    this.context.stores.get<HealthComponent>("health").add(weaverId, { current: 100, max: 100 });
    this.context.stores.get<WeaverTag>("weaverTag").add(weaverId, {});
    
    this.context.stores.get<WeaverTraversalComponent>("weaverTraversal").add(weaverId, {
      velX: 4.5,
      velY: 0,
      isGrounded: false,
      isWallClinging: false,
      wallNormalX: 0
    });
    
    this.context.refs.weaver = weaverId;

    const wMesh = BABYLON.MeshBuilder.CreateIcoSphere(
      "weaverVisual",
      { radius: ARENA_CONFIG.ENTITY.WEAVER_RADIUS, subdivisions: 5 },
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
    const shearPlugin = new RasterShearPlugin(wMat);
    (wMat as BABYLON.PBRMaterial & { _shearPlugin?: RasterShearPlugin })._shearPlugin = shearPlugin;
    this.context.visualRegistry.registerTransformNode(weaverId, wMesh);

    if (scene.isPhysicsEnabled() && this.sharedWeaverShape) {
      const wBody = new BABYLON.PhysicsBody(wMesh, BABYLON.PhysicsMotionType.ANIMATED, false, scene);
      wBody.shape = this.sharedWeaverShape;
      wBody.setMassProperties({ mass: 100.0 });
    }

    return weaverId;
  }

  public spawnPlayer(existingId?: EntityId): EntityId {
    const scene = this.context.visualRegistry.getScene();
    if (!scene) return -1;

    const playerId = existingId ?? this.context.world.create();
    this.context.world.clearEntityComponents(playerId);

    this.context.visualRegistry.unregisterTransformNode(playerId);

    this.context.stores.get<TransformComponent>("transform").add(playerId, {
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
    
    this.context.stores.get<KinematicVelocityComponent>("velocity").add(playerId, { x: 0, y: 0, z: 0 });
    this.context.stores.get<KinematicTargetComponent>("target").add(playerId, { x: 0, y: ARENA_CONFIG.VERTICAL.PLAYER_SPAWN_Y, z: 0, active: true });
    
    this.context.stores.get<TetherComponent>("tether").add(playerId, {
      anchorX: 0,
      anchorY: ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y,
      anchorZ: 0,
      maxLength: ARENA_CONFIG.TETHER.INITIAL_LENGTH,
      currentLength: ARENA_CONFIG.TETHER.INITIAL_LENGTH,
      isAttached: true,
      tension: 0.0,
      dynamicVelX: 0.0,
      dynamicVelY: 0.0
    });
    
    this.context.stores.get<HealthComponent>("health").add(playerId, { current: GAMEPLAY_TUNING.PLAYER.MAX_INTEGRITY, max: GAMEPLAY_TUNING.PLAYER.MAX_INTEGRITY });
    this.context.stores.get<InputIntentComponent>("input").add(playerId, { x: 0, y: 0, jump: false });
    this.context.stores.get<PlayerTag>("playerTag").add(playerId, {});
    
    this.context.stores.get<TraversalStateComponent>("traversal").add(playerId, {
      state: "AIRBORNE",
      wallNormalX: 0,
      wallNormalY: 0,
      wallDir: 0,
      launchTimer: 0.0,
      launchPower: 0.0
    });
    
    this.context.stores.get<InvulnerabilityComponent>("iframe").add(playerId, { timeRemaining: 0 });
    this.context.refs.player = playerId;

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
    this.context.visualRegistry.registerTransformNode(playerId, pMesh);

    if (scene.isPhysicsEnabled() && this.sharedPlayerShape) {
      const pBody = new BABYLON.PhysicsBody(pMesh, BABYLON.PhysicsMotionType.ANIMATED, false, scene);
      pBody.shape = this.sharedPlayerShape;
      pBody.setMassProperties({ mass: 10.0 });
    }

    return playerId;
  }
  
  public dispose(): void {
    if (this.sharedWeaverShape) this.sharedWeaverShape.dispose();
    if (this.sharedPlayerShape) this.sharedPlayerShape.dispose();
  }
}
