import { ISystem } from "../contracts/ISystem";
import { SystemPhase, InitPhase } from "../contracts/SystemPhase";
import { EntityId } from "../core/ecs/Entity";
import { SystemContext } from "../core/engine/SystemContext";
import { ARENA_CONFIG } from "../core/engine/ArenaConfig";
import { EntityAssembler } from "./EntityAssembler";
import { GameEvent } from "../core/events/GameEvents";
import { SubscriptionTracker } from "../core/utils/EngineUtils";
import * as BABYLON from "@babylonjs/core";

export class EntitySpawnerSystem implements ISystem {
  readonly phase = SystemPhase.Intents;
  readonly initPhase = InitPhase.World;
  private sharedPlayerShape: BABYLON.PhysicsShapeCapsule | null = null;
  private _tracker = new SubscriptionTracker();

  constructor(private context: SystemContext) {}

  public init(): void {
    const scene = this.context.visualQuery.getScene();
    if (scene && scene.isPhysicsEnabled()) {
      const cylHalfHeight =
        (ARENA_CONFIG.ENTITY.PLAYER_HEIGHT - 2 * ARENA_CONFIG.ENTITY.PLAYER_RADIUS) / 2;
      this.sharedPlayerShape = new BABYLON.PhysicsShapeCapsule(
        new BABYLON.Vector3(0, -cylHalfHeight, 0),
        new BABYLON.Vector3(0, cylHalfHeight, 0),
        ARENA_CONFIG.ENTITY.PLAYER_RADIUS,
        scene
      );
    }

    // Pre-spawn entities on initialization so they are fully loaded, textured, and compiled
    this.spawnWeaver();
    this.spawnPlayer();

    // Initially hide them so they do not render or glitch behind the loading/start overlays
    this.setEntitiesEnabled(false);

    // Show them when the game state officially starts
    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_STARTED, () => {
        this.setEntitiesEnabled(true);
      })
    );

    // Respawn/Reset entities on game reset
    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.despawnAll();
        this.spawnWeaver();
        this.spawnPlayer();
        this.setEntitiesEnabled(true);
      })
    );
  }

  private setEntitiesEnabled(enabled: boolean): void {
    const weaverId = this.context.refs.weaver;
    const playerId = this.context.refs.player;

    const wNode = this.context.visualQuery.getTransformNode(weaverId);
    const pNode = this.context.visualQuery.getTransformNode(playerId);

    if (wNode) wNode.setEnabled(enabled);
    if (pNode) pNode.setEnabled(enabled);
  }

  public spawnWeaver(existingId?: EntityId): EntityId {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return -1;

    const weaverId = existingId ?? this.context.world.create();
    this.context.world.clearEntityComponents(weaverId);

    EntityAssembler.assembleWeaver(this.context, weaverId, scene);
    this.context.refs.weaver = weaverId;

    return weaverId;
  }

  public spawnPlayer(existingId?: EntityId): EntityId {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return -1;

    const playerId = existingId ?? this.context.world.create();
    this.context.world.clearEntityComponents(playerId);

    EntityAssembler.assemblePlayer(this.context, playerId, scene, this.sharedPlayerShape);
    this.context.refs.player = playerId;

    return playerId;
  }

  private despawnAll(): void {
    const weaverId = this.context.refs.weaver;
    const playerId = this.context.refs.player;

    if (weaverId !== -1) {
      this.context.world.clearEntityComponents(weaverId);
    }
    if (playerId !== -1) {
      this.context.world.clearEntityComponents(playerId);
    }
  }

  public dispose(): void {
    if (this.sharedPlayerShape) this.sharedPlayerShape.dispose();
    this._tracker.clear();
  }
}
