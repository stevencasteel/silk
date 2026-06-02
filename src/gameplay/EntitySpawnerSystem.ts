import { ISystem } from "../contracts/ISystem";
import { SystemPhase, InitPhase } from "../contracts/SystemPhase";
import { EntityId } from "../core/ecs/Entity";
import { SystemContext } from "../core/engine/SystemContext";
import { ARENA_CONFIG } from "../core/engine/ArenaConfig";
import { EntityAssembler } from "./EntityAssembler";
import { ParticleRequestComponent } from "../core/ecs/Components";
import { MaterializeImplosionStrategy } from "./juice/ParticleStrategies";
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
      status: "Generating boss character...", phase: 1
    });
    await this.spawnWeaver();

    this.context.broker.publish(GameEvent.GAME_BOOT_PROGRESS, {
      status: "Generating player character...", phase: 1
    });
    await this.spawnPlayer();

    


  }

  

  public async spawnWeaver(existingId?: EntityId): Promise<EntityId> {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return -1;

    const weaverId = existingId ?? this.context.world.create();
    this.context.world.clearEntityComponents(weaverId);

await EntityAssembler.assembleWeaver(this.context, weaverId, scene);
    this.context.refs.weaver = weaverId;

    const reqStore = this.context.stores.get<ParticleRequestComponent>("particleRequest");
    if (reqStore) {
      const reqId = this.context.world.create();
      reqStore.add(reqId, {
        strategy: new MaterializeImplosionStrategy(new BABYLON.Color3(1.0, 0.0, 0.5)),
        x: 0,
        y: ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y,
        z: 0
      });
    }

    return weaverId;
  }

  public async spawnPlayer(existingId?: EntityId): Promise<EntityId> {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return -1;

    const playerId = existingId ?? this.context.world.create();
    this.context.world.clearEntityComponents(playerId);

await EntityAssembler.assemblePlayer(this.context, playerId, scene, this.sharedPlayerShape);
    this.context.refs.player = playerId;

    const initialY = ARENA_CONFIG.VERTICAL.WEAVER_SPAWN_Y - ARENA_CONFIG.TETHER.INITIAL_LENGTH;
    const reqStore = this.context.stores.get<ParticleRequestComponent>("particleRequest");
    if (reqStore) {
      const reqId = this.context.world.create();
      reqStore.add(reqId, {
        strategy: new MaterializeImplosionStrategy(new BABYLON.Color3(0.9, 0.95, 1.0)),
        x: 0,
        y: initialY,
        z: 0
      });
    }

    return playerId;
  }



  public dispose(): void {
    if (this.sharedPlayerShape) this.sharedPlayerShape.dispose();
    this._tracker.clear();
  }
}
