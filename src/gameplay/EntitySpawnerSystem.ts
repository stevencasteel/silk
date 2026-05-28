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
  WeaverTraversalComponent,
  WeaverSweepComponent
} from "../core/ecs/Components";
import { ARENA_CONFIG, GAMEPLAY_TUNING, VISUAL_JUICE_CONFIG } from "../core/engine/ArenaConfig";
import { createWeaverVisualMesh } from "../visual/mesh/WeaverVisualFactory";
import { createPlayerVisualMesh } from "../visual/mesh/PlayerSilkVisualFactory";
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
      this.sharedWeaverShape = new BABYLON.PhysicsShapeSphere(
        BABYLON.Vector3.Zero(),
        ARENA_CONFIG.ENTITY.WEAVER_RADIUS,
        scene
      );
      const cylHalfHeight =
        (ARENA_CONFIG.ENTITY.PLAYER_HEIGHT - 2 * ARENA_CONFIG.ENTITY.PLAYER_RADIUS) / 2;
      this.sharedPlayerShape = new BABYLON.PhysicsShapeCapsule(
        new BABYLON.Vector3(0, -cylHalfHeight, 0),
        new BABYLON.Vector3(0, cylHalfHeight, 0),
        ARENA_CONFIG.ENTITY.PLAYER_RADIUS,
        scene
      );
    }
    this.spawnWeaver();
    this.spawnPlayer();
  }

  public spawnWeaver(existingId?: EntityId): EntityId {
    const scene = this.context.visualRegistry.getScene();
    if (!scene) return -1;

    const weaverId = existingId ?? this.context.world.create();
    this.context.world.clearEntityComponents(weaverId);

    const existingNode = this.context.visualRegistry.getTransformNode(weaverId);

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
      prevQw: 1,
      scaleX: 1.0,
      scaleY: 1.0,
      scaleZ: 1.0,
      prevScaleX: 1.0,
      prevScaleY: 1.0,
      prevScaleZ: 1.0,
      scaleVelX: 0.0,
      scaleVelY: 0.0,
      scaleVelZ: 0.0
    });

    this.context.stores
      .get<KinematicVelocityComponent>("velocity")
      .add(weaverId, { x: ARENA_CONFIG.ENTITY_SPAWNER.WEAVER_INITIAL_VELOCITY_X, y: 0, z: 0 });
    this.context.stores
      .get<KinematicTargetComponent>("target")
      .add(weaverId, { x: 0, y: ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y, z: 0, active: true });

    this.context.stores.get<WeaverAIComponent>("weaverAI").add(weaverId, {
      state: "PATROLLING",
      timeInState: 0,
      hue: String.fromCharCode(35) + VISUAL_JUICE_CONFIG.WEAVER_COLORS.SWEEPING,
      scrollSpeed: ARENA_CONFIG.SCROLL_SPEED.BASE,
      damageShearIntensity: 0.0,
      damageShearTime: 0.0
    });

    this.context.stores.get<HealthComponent>("health").add(weaverId, { current: 100, max: 100 });
    this.context.stores.get<WeaverTag>("weaverTag").add(weaverId, {});

    this.context.stores.get<WeaverTraversalComponent>("weaverTraversal").add(weaverId, {
      isGrounded: false,
      isWallClinging: false,
      wallNormalX: 0
    });

    this.context.stores.get<WeaverSweepComponent>("weaverSweep").add(weaverId, {
      phase: "SWEEP",
      timer: 0.0,
      direction: ARENA_CONFIG.ENTITY_SPAWNER.WEAVER_INITIAL_VELOCITY_X >= 0 ? 1 : -1
    });

    this.context.refs.weaver = weaverId;

    if (existingNode) {
      existingNode.position.set(0, ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y, 0);
      existingNode.rotationQuaternion = BABYLON.Quaternion.Identity();
      existingNode.scaling.set(1.0, 1.0, 1.0);
      existingNode.setEnabled(true);
      return weaverId;
    }

    const radius = ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
    const regCaster = this.context.visualRegistry.registerShadowCaster
      ? (m: BABYLON.AbstractMesh) => this.context.visualRegistry.registerShadowCaster!(m)
      : undefined;

    const wMesh = createWeaverVisualMesh(
      scene,
      radius,
      ARENA_CONFIG.ENTITY.WEAVER_ICOSPHERE_SUBDIVISIONS,
      regCaster
    );

    this.context.visualRegistry.registerTransformNode(weaverId, wMesh);

    if (scene.isPhysicsEnabled()) {
      const wBody = new BABYLON.PhysicsBody(
        wMesh,
        BABYLON.PhysicsMotionType.ANIMATED,
        false,
        scene
      );
      wBody.disablePreStep = false;
      const wShape = new BABYLON.PhysicsShapeConvexHull(wMesh, scene);
      wBody.shape = wShape;
      wBody.setMassProperties({ mass: ARENA_CONFIG.ENTITY_SPAWNER.WEAVER_PHYSICS_MASS });
    }

    return weaverId;
  }

  public spawnPlayer(existingId?: EntityId): EntityId {
    const scene = this.context.visualRegistry.getScene();
    if (!scene) return -1;

    const playerId = existingId ?? this.context.world.create();
    this.context.world.clearEntityComponents(playerId);

    const existingNode = this.context.visualRegistry.getTransformNode(playerId);

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
      prevQw: 1,
      scaleX: 1.0,
      scaleY: 1.0,
      scaleZ: 1.0,
      prevScaleX: 1.0,
      prevScaleY: 1.0,
      prevScaleZ: 1.0,
      scaleVelX: 0.0,
      scaleVelY: 0.0,
      scaleVelZ: 0.0
    });

    this.context.stores
      .get<KinematicVelocityComponent>("velocity")
      .add(playerId, { x: 0, y: 0, z: 0 });
    this.context.stores
      .get<KinematicTargetComponent>("target")
      .add(playerId, { x: 0, y: ARENA_CONFIG.VERTICAL.PLAYER_SPAWN_Y, z: 0, active: true });

    this.context.stores.get<TetherComponent>("tether").add(playerId, {
      anchorX: 0,
      anchorY: ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y,
      anchorZ: 0,
      maxLength: ARENA_CONFIG.TETHER.INITIAL_LENGTH,
      currentLength: ARENA_CONFIG.TETHER.INITIAL_LENGTH,
      isAttached: true,
      tension: 0.0,
      desiredLength: ARENA_CONFIG.TETHER.INITIAL_LENGTH,
      reelVelocity: 0.0,
      reelHeat: 0.0
    });

    this.context.stores.get<HealthComponent>("health").add(playerId, {
      current: GAMEPLAY_TUNING.PLAYER.MAX_INTEGRITY,
      max: GAMEPLAY_TUNING.PLAYER.MAX_INTEGRITY
    });
    this.context.stores.get<InputIntentComponent>("input").add(playerId, { x: 0, y: 0 });
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

    if (existingNode) {
      existingNode.position.set(0, ARENA_CONFIG.VERTICAL.PLAYER_SPAWN_Y, 0);
      existingNode.rotationQuaternion = BABYLON.Quaternion.Identity();
      existingNode.scaling.set(1.0, 1.0, 1.0);
      existingNode.setEnabled(true);
      return playerId;
    }

    const pMesh = createPlayerVisualMesh(
      scene,
      ARENA_CONFIG.ENTITY.PLAYER_HEIGHT,
      ARENA_CONFIG.ENTITY.PLAYER_RADIUS,
      ARENA_CONFIG.ENTITY.PLAYER_CAPSULE_SUBDIVISIONS
    );

    this.context.visualRegistry.registerTransformNode(playerId, pMesh);

    if (scene.isPhysicsEnabled() && this.sharedPlayerShape) {
      const pBody = new BABYLON.PhysicsBody(
        pMesh,
        BABYLON.PhysicsMotionType.ANIMATED,
        false,
        scene
      );
      pBody.disablePreStep = false;
      pBody.shape = this.sharedPlayerShape;
      pBody.setMassProperties({ mass: ARENA_CONFIG.ENTITY_SPAWNER.PLAYER_PHYSICS_MASS });
    }

    return playerId;
  }

  public dispose(): void {
    if (this.sharedWeaverShape) this.sharedWeaverShape.dispose();
    if (this.sharedPlayerShape) this.sharedPlayerShape.dispose();
  }
}
