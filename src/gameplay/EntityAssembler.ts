import { triggerMeshFadeIn } from "../core/utils/EngineUtils";
import { SystemContext } from "../core/engine/SystemContext";
import { EntityId } from "../core/ecs/Entity";
import {
  HitStopComponent,
  TransformComponent,
  KinematicVelocityComponent,
  KinematicTargetComponent,
  TetherComponent,
  HealthComponent,
  InputIntentComponent,
  WeaverAIComponent,
  TagComponent,
  TraversalStateComponent,
  InvulnerabilityComponent,
  WeaverTraversalComponent,
  WeaverSweepComponent,
  HurtboxComponent,
  HitboxComponent,
  ActorCosmeticComponent,
  CollisionResponseComponent,
  BoundaryConstraintComponent,
  CollisionStateComponent
} from "../core/ecs/Components";
import { ARENA_CONFIG, GAMEPLAY_TUNING, VISUAL_JUICE_CONFIG } from "../core/engine/ArenaConfig";
import { createWeaverVisualMesh } from "../visual/mesh/WeaverVisualFactory";
import { createPlayerVisualMesh } from "../visual/mesh/PlayerSilkVisualFactory";
import * as BABYLON from "@babylonjs/core";
import { GameEvent } from "../core/events/GameEvents";

export class EntityAssembler {
  public static async assembleWeaver(
    context: SystemContext,
    weaverId: EntityId,
    scene: BABYLON.Scene
  ): Promise<void> {
    context.stores.get<TransformComponent>("transform").add(weaverId, {
      x: 0,
      y: ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y,
      z: 0,
      qx: 0,
      qy: 0,
      qz: 0,
      qw: 1,
      prevX: 0,
      prevY: ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y,
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

    context.stores
      .get<KinematicVelocityComponent>("velocity")
      .add(weaverId, { x: ARENA_CONFIG.ENTITY_SPAWNER.WEAVER_INITIAL_VELOCITY_X, y: 0, z: 0 });
    context.stores
      .get<KinematicTargetComponent>("target")
      .add(weaverId, { x: 0, y: ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y, z: 0, active: true });

    context.stores.get<WeaverAIComponent>("weaverAI").add(weaverId, {
      state: "PATROLLING",
      timeInState: 0,
      hue: String.fromCharCode(35) + VISUAL_JUICE_CONFIG.WEAVER_COLORS.SWEEPING,
      damageShearIntensity: 0.0,
      damageShearTime: 0.0,
      desiredVelocityX: ARENA_CONFIG.ENTITY_SPAWNER.WEAVER_INITIAL_VELOCITY_X,
      desiredVelocityY: 0,
      shootRequested: false,
      shakeRequested: false
    });

    context.stores.get<HealthComponent>("health").add(weaverId, { current: 100, max: 100 });
    context.stores.get<TagComponent>("tag").add(weaverId, { type: "weaver" });
    context.stores.get<HitStopComponent>("hitStop").add(weaverId, { timeRemaining: 0 });

    context.stores.get<ActorCosmeticComponent>("cosmetic").add(weaverId, {
      emissiveHue: String.fromCharCode(35) + VISUAL_JUICE_CONFIG.WEAVER_COLORS.SWEEPING,
      targetScaleX: 1.0,
      targetScaleY: 1.0,
      targetScaleZ: 1.0,
      springStiffness: 120,
      springDamping: 22,
      wobbleAngle: 0.0,
      rotationAngle: 0.0,
      rotationSpeed: 12.0,
      gaitAmplitude: 0.12,
      gaitFrequency: 8.0,
      gaitTuck: 0.0
    });

    context.stores.get<CollisionResponseComponent>("collisionResponse").add(weaverId, {
      layer: "WEAVER",
      onHit: (damage, source, dx, dy, ctx) => {
        const sysCtx = ctx as SystemContext;
        const tuning = GAMEPLAY_TUNING.COMBAT;
        sysCtx.commands.dispatch({
          type: "DAMAGE_REQUEST",
          targetId: weaverId,
          amount: damage,
          source
        });

        sysCtx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
          amplitude: 1.4,
          duration: 0.55,
          dirX: dx,
          dirY: dy
        });

        const pId = sysCtx.refs.player;
        const wId = sysCtx.refs.weaver;

        const transforms = sysCtx.stores.get<TransformComponent>("transform");
        const targets = sysCtx.stores.get<KinematicTargetComponent>("target");
        const velocities = sysCtx.stores.get<KinematicVelocityComponent>("velocity");

        const pTrans = transforms.get(pId);
        const wTrans = transforms.get(wId);
        const pTarget = targets.get(pId);
        const pVel = velocities.get(pId);

        if (pTrans && wTrans && pTarget) {
          const combinedRadius = ARENA_CONFIG.ENTITY.PLAYER_RADIUS + ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
          pTrans.x = wTrans.x - dx * (combinedRadius + 0.05);
          pTrans.y = wTrans.y - dy * (combinedRadius + 0.05);
          pTrans.prevX = pTrans.x;
          pTrans.prevY = pTrans.y;
          pTarget.x = pTrans.x;
          pTarget.y = pTrans.y;
        }

        if (pVel) {
          const incomingSpeed = Math.sqrt(pVel.x * pVel.x + pVel.y * pVel.y);
          const bounceSpeed = Math.max(tuning.REBOUND_FORCE, incomingSpeed * 0.45);
          pVel.x = -dx * bounceSpeed;
          pVel.y = -dy * bounceSpeed;
        }

        const trav = sysCtx.stores.get<TraversalStateComponent>("traversal").get(pId);
        if (trav) {
          trav.state = "AIRBORNE";
          trav.launchPower = 0;
          trav.launchTimer = 0;
        }
      }
    });

    context.stores.get<WeaverTraversalComponent>("weaverTraversal").add(weaverId, {
      isGrounded: false,
      isWallClinging: false,
      wallNormalX: 0
    });

    context.stores.get<WeaverSweepComponent>("weaverSweep").add(weaverId, {
      phase: "SWEEP",
      timer: 0.0,
      direction: ARENA_CONFIG.ENTITY_SPAWNER.WEAVER_INITIAL_VELOCITY_X >= 0 ? 1 : -1
    });

    context.stores.get<HurtboxComponent>("hurtbox").add(weaverId, {
      ownerId: weaverId,
      isActive: true,
      radius: ARENA_CONFIG.ENTITY.WEAVER_RADIUS,
      layer: "WEAVER"
    });

    context.stores.get<HitboxComponent>("hitbox").add(weaverId, {
      ownerId: weaverId,
      isActive: false,
      radius: ARENA_CONFIG.ENTITY.WEAVER_RADIUS,
      damage: GAMEPLAY_TUNING.COMBAT.WEAVER_CONTACT_DAMAGE,
      targetLayer: "PLAYER"
    });

    const existingNode = context.visualQuery.getTransformNode(weaverId);
    if (existingNode) {
      existingNode.position.set(0, ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y, 0);
      existingNode.rotationQuaternion = BABYLON.Quaternion.Identity();
      existingNode.scaling.set(1.0, 1.0, 1.0);
      existingNode.setEnabled(true);
      triggerMeshFadeIn(existingNode, 0.6);
      return;
    }

    const radius = ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
    const regCaster = (m: BABYLON.AbstractMesh) =>
      context.visualRegistration.registerShadowCaster(m);

    const wMesh = await createWeaverVisualMesh(
      scene,
      radius,
      ARENA_CONFIG.ENTITY.WEAVER_ICOSPHERE_SUBDIVISIONS,
      regCaster
    );

    context.visualRegistration.registerTransformNode(weaverId, wMesh);
    triggerMeshFadeIn(wMesh, 0.6);

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
  }

  public static async assemblePlayer(
    context: SystemContext,
    playerId: EntityId,
    scene: BABYLON.Scene,
    sharedPlayerShape: BABYLON.PhysicsShapeCapsule | null
  ): Promise<void> {
    const initialY = ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y - ARENA_CONFIG.TETHER.INITIAL_LENGTH;

    context.stores.get<TransformComponent>("transform").add(playerId, {
      x: 0,
      y: initialY,
      z: 0,
      qx: 0,
      qy: 0,
      qz: 0,
      qw: 1,
      prevX: 0,
      prevY: initialY,
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

    context.stores.get<KinematicVelocityComponent>("velocity").add(playerId, { x: 0, y: 0, z: 0 });
    context.stores
      .get<KinematicTargetComponent>("target")
      .add(playerId, { x: 0, y: initialY, z: 0, active: true });

    context.stores.get<TetherComponent>("tether").add(playerId, {
      anchorX: 0,
      anchorY: ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y,
      anchorZ: 0,
      maxLength: ARENA_CONFIG.TETHER.INITIAL_LENGTH,
      currentLength: ARENA_CONFIG.TETHER.INITIAL_LENGTH,
      isAttached: true,
      tension: 0.0,
      desiredLength: ARENA_CONFIG.TETHER.INITIAL_LENGTH,
      reelVelocity: 0.0
    });

    context.stores.get<HealthComponent>("health").add(playerId, {
      current: GAMEPLAY_TUNING.PLAYER.MAX_INTEGRITY,
      max: GAMEPLAY_TUNING.PLAYER.MAX_INTEGRITY
    });
    context.stores.get<InputIntentComponent>("input").add(playerId, { x: 0, y: 0 });
    context.stores.get<TagComponent>("tag").add(playerId, { type: "player" });
    context.stores.get<HitStopComponent>("hitStop").add(playerId, { timeRemaining: 0 });

    context.stores.get<ActorCosmeticComponent>("cosmetic").add(playerId, {
      emissiveR: VISUAL_JUICE_CONFIG.EMISSIVE.PLAYER_EMISSIVE_DEFAULT.R,
      emissiveG: VISUAL_JUICE_CONFIG.EMISSIVE.PLAYER_EMISSIVE_DEFAULT.G,
      emissiveB: VISUAL_JUICE_CONFIG.EMISSIVE.PLAYER_EMISSIVE_DEFAULT.B,
      targetScaleX: 1.0,
      targetScaleY: 1.0,
      targetScaleZ: 1.0,
      springStiffness: 220,
      springDamping: 14,
      rotationAngle: 0.0,
      slerpFactor: GAMEPLAY_TUNING.PLAYER.SLERP_FACTOR,
      visualOffsetY: 0.0,
      visualOffsetVelocityY: 0.0
    });

    context.stores.get<BoundaryConstraintComponent>("boundaryConstraint").add(playerId, {
      isActive: true,
      limitX: ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X,
      layer: "PLAYER",
      onBoundaryHit: (id: number, side: "LEFT" | "RIGHT") => {
        const colStore = context.stores.get<CollisionStateComponent>("collisionState");
        const pCol = colStore.get(id);
        const pTrans = context.stores.get<TransformComponent>("transform").get(id);
        if (pCol && pTrans) {
          pCol.isWallClinging = true;
          pCol.wallNormalX = side === "RIGHT" ? -1 : 1;
          pCol.lastHitType = "WALL";
          pCol.hitPointX =
            side === "RIGHT"
              ? ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X
              : -ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;
          pCol.hitPointY = pTrans.y;
        }
      }
    });

    context.stores.get<CollisionResponseComponent>("collisionResponse").add(playerId, {
      layer: "PLAYER",
      onHit: (damage, source, dx, dy, ctx) => {
        const sysCtx = ctx as SystemContext;
        const iframeStore = sysCtx.stores.get<InvulnerabilityComponent>("iframe");
        const pIframe = iframeStore.get(playerId);
        if (pIframe && pIframe.timeRemaining <= 0) {
          const tuning = GAMEPLAY_TUNING.COMBAT;
          const kbX = dx * tuning.KNOCKBACK_FORCE_X;
          const kbY = dy * tuning.KNOCKBACK_FORCE_Y + tuning.KNOCKBACK_BONUS_Y;

          sysCtx.commands.dispatch({
            type: "DAMAGE_REQUEST",
            targetId: playerId,
            amount: damage,
            source,
            knockbackX: kbX,
            knockbackY: kbY
          });

          sysCtx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
            amplitude: 0.5,
            duration: 0.3,
            dirX: dx,
            dirY: dy
          });
        }
      }
    });

    context.stores.get<TraversalStateComponent>("traversal").add(playerId, {
      state: "AIRBORNE",
      wallNormalX: 0,
      wallNormalY: 0,
      wallDir: 0,
      launchTimer: 0.0,
      launchPower: 0.0
    });

    context.stores.get<InvulnerabilityComponent>("iframe").add(playerId, { timeRemaining: 0 });

    context.stores.get<HurtboxComponent>("hurtbox").add(playerId, {
      ownerId: playerId,
      isActive: true,
      radius: ARENA_CONFIG.ENTITY.PLAYER_RADIUS,
      layer: "PLAYER"
    });

    context.stores.get<HitboxComponent>("hitbox").add(playerId, {
      ownerId: playerId,
      isActive: false,
      radius: ARENA_CONFIG.ENTITY.PLAYER_RADIUS,
      damage: GAMEPLAY_TUNING.COMBAT.PLAYER_FLING_DAMAGE,
      targetLayer: "WEAVER"
    });

    const existingNode = context.visualQuery.getTransformNode(playerId);
    if (existingNode) {
      existingNode.position.set(0, initialY, 0);
      existingNode.rotationQuaternion = BABYLON.Quaternion.Identity();
      existingNode.scaling.set(1.0, 1.0, 1.0);
      existingNode.setEnabled(true);
      triggerMeshFadeIn(existingNode, 0.6);
      return;
    }

    const pMesh = await createPlayerVisualMesh(
      scene,
      ARENA_CONFIG.ENTITY.PLAYER_HEIGHT,
      ARENA_CONFIG.ENTITY.PLAYER_RADIUS,
      ARENA_CONFIG.ENTITY.PLAYER_CAPSULE_SUBDIVISIONS
    );

    context.visualRegistration.registerTransformNode(playerId, pMesh);
    triggerMeshFadeIn(pMesh, 0.6);

    if (scene.isPhysicsEnabled() && sharedPlayerShape) {
      const pBody = new BABYLON.PhysicsBody(
        pMesh,
        BABYLON.PhysicsMotionType.ANIMATED,
        false,
        scene
      );
      pBody.disablePreStep = false;
      pBody.shape = sharedPlayerShape;
      pBody.setMassProperties({ mass: ARENA_CONFIG.ENTITY_SPAWNER.PLAYER_PHYSICS_MASS });
    }
  }
}
