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

    const oldNode = this.context.visualRegistry.getTransformNode(weaverId);
    if (oldNode) {
      const oldMesh = oldNode as BABYLON.AbstractMesh;
      if (oldMesh.physicsBody) {
        if (oldMesh.physicsBody.shape) {
          oldMesh.physicsBody.shape.dispose();
        }
        oldMesh.physicsBody.dispose();
      }
      this.context.visualRegistry.unregisterTransformNode(weaverId);
    }

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

    this.context.refs.weaver = weaverId;

    const radius = ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
    const wMesh = BABYLON.MeshBuilder.CreateIcoSphere(
      "weaverVisual",
      { radius: radius, subdivisions: ARENA_CONFIG.ENTITY.WEAVER_ICOSPHERE_SUBDIVISIONS },
      scene
    );

    if (ARENA_CONFIG.ENTITY.WEAVER_RADIUS > 0) {
      const positions = wMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      if (positions) {
        for (let i = 0; i < positions.length; i += 3) {
          const x = positions[i];
          const y = positions[i + 1];
          const z = positions[i + 2];
          if (y < 0) {
            const r_sphere = Math.sqrt(radius * radius - y * y);
            if (r_sphere > 0.001) {
              const r_cone = radius * (1.0 + y / radius);
              const scaleFactor = r_cone / r_sphere;
              positions[i] = x * scaleFactor;
              positions[i + 2] = z * scaleFactor;
            } else {
              positions[i] = 0;
              positions[i + 2] = 0;
            }
          }
        }
        wMesh.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
        const normals: number[] = [];
        const indices = wMesh.getIndices();
        if (indices) {
          BABYLON.VertexData.ComputeNormals(positions, indices, normals);
          wMesh.setVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
        }
      }
    }

    const wc = ARENA_CONFIG.ENTITY_COLORS.WEAVER_ALBEDO;
    const wMat = new BABYLON.PBRMaterial("weaverMat", scene);
    wMat.albedoColor = new BABYLON.Color3(wc.r, wc.g, wc.b);
    wMat.metallic = VISUAL_JUICE_CONFIG.MATERIALS.WEAVER.METALLIC;
    wMat.roughness = VISUAL_JUICE_CONFIG.MATERIALS.WEAVER.ROUGHNESS;
    wMat.clearCoat.isEnabled = true;
    wMat.clearCoat.intensity = VISUAL_JUICE_CONFIG.MATERIALS.WEAVER.CLEAR_COAT_INTENSITY;
    wMat.clearCoat.roughness = VISUAL_JUICE_CONFIG.MATERIALS.WEAVER.CLEAR_COAT_ROUGHNESS;
    wMesh.material = wMat;
    const shearPlugin = new RasterShearPlugin(wMat);
    (wMat as BABYLON.PBRMaterial & { _shearPlugin?: RasterShearPlugin })._shearPlugin = shearPlugin;
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

    const oldNode = this.context.visualRegistry.getTransformNode(playerId);
    if (oldNode) {
      const oldMesh = oldNode as BABYLON.AbstractMesh;
      if (oldMesh.physicsBody) {
        oldMesh.physicsBody.dispose();
      }
      this.context.visualRegistry.unregisterTransformNode(playerId);
    }

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

    this.context.stores
      .get<HealthComponent>("health")
      .add(playerId, {
        current: GAMEPLAY_TUNING.PLAYER.MAX_INTEGRITY,
        max: GAMEPLAY_TUNING.PLAYER.MAX_INTEGRITY
      });
    this.context.stores
      .get<InputIntentComponent>("input")
      .add(playerId, { x: 0, y: 0, jump: false });
    this.context.stores
      .get<PlayerTag>("playerTag")
      .add(playerId, {});

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
      {
        height: ARENA_CONFIG.ENTITY.PLAYER_HEIGHT,
        radius: ARENA_CONFIG.ENTITY.PLAYER_RADIUS,
        subdivisions: ARENA_CONFIG.ENTITY.PLAYER_CAPSULE_SUBDIVISIONS
      },
      scene
    );
    const pc = ARENA_CONFIG.ENTITY_COLORS.PLAYER_ALBEDO;
    const pMat = new BABYLON.PBRMaterial("playerMat", scene);
    pMat.albedoColor = new BABYLON.Color3(pc.r, pc.g, pc.b);
    pMat.metallic = VISUAL_JUICE_CONFIG.MATERIALS.PLAYER.METALLIC;
    pMat.roughness = VISUAL_JUICE_CONFIG.MATERIALS.PLAYER.ROUGHNESS;
    pMat.sheen.isEnabled = true;
    pMat.sheen.intensity = VISUAL_JUICE_CONFIG.MATERIALS.PLAYER.SHEEN_INTENSITY;
    pMat.sheen.roughness = VISUAL_JUICE_CONFIG.MATERIALS.PLAYER.SHEEN_ROUGHNESS;
    const psc = ARENA_CONFIG.ENTITY_COLORS.PLAYER_SHEEN;
    pMat.sheen.color = new BABYLON.Color3(psc.r, psc.g, psc.b);
    pMesh.material = pMat;
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
