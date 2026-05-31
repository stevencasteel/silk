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

  public async init(): Promise<void> {
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

    this.context.broker.publish(GameEvent.GAME_BOOT_PROGRESS, {
      status: "GENERATING WEAVER CARAPACE AND PBR TEXTURES..."
    });
    await this.spawnWeaver();

    this.context.broker.publish(GameEvent.GAME_BOOT_PROGRESS, {
      status: "GENERATING PLAYER COCOON SILK TEXTURES..."
    });
    await this.spawnPlayer();

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_BOOT_PROGRESS, (payload) => {
        if (payload.status === "READY") {
          this.setEntitiesEnabled(false);
        }
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_STARTED, () => {
        this.setEntitiesEnabled(true);
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.despawnAll();
        Promise.all([
          this.spawnWeaver(),
          this.spawnPlayer()
        ]).then(() => {
          this.setEntitiesEnabled(true);
        });
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

  public async spawnWeaver(existingId?: EntityId): Promise<EntityId> {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return -1;

    const weaverId = existingId ?? this.context.world.create();
    this.context.world.clearEntityComponents(weaverId);

    await EntityAssembler.assembleWeaver(this.context, weaverId, scene);
    this.context.refs.weaver = weaverId;

    return weaverId;
  }

  public async spawnPlayer(existingId?: EntityId): Promise<EntityId> {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return -1;

    const playerId = existingId ?? this.context.world.create();
    this.context.world.clearEntityComponents(playerId);

    await EntityAssembler.assemblePlayer(this.context, playerId, scene, this.sharedPlayerShape);
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
