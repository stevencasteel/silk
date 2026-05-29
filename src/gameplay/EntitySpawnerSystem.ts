import { ISystem } from "../contracts/ISystem";
import { SystemPhase, InitPhase } from "../contracts/SystemPhase";
import { EntityId } from "../core/ecs/Entity";
import { SystemContext } from "../core/engine/SystemContext";
import { ARENA_CONFIG } from "../core/engine/ArenaConfig";
import { EntityAssembler } from "./EntityAssembler";
import * as BABYLON from "@babylonjs/core";

export class EntitySpawnerSystem implements ISystem {
  readonly phase = SystemPhase.Intents;
  readonly initPhase = InitPhase.World;
  private sharedPlayerShape: BABYLON.PhysicsShapeCapsule | null = null;

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
    this.spawnWeaver();
    this.spawnPlayer();
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

  public dispose(): void {
    if (this.sharedPlayerShape) this.sharedPlayerShape.dispose();
  }
}
