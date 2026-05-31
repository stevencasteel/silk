import * as BABYLON from "@babylonjs/core";
import { SystemContext } from "../../core/engine/SystemContext";
import { EntityId } from "../../core/ecs/Entity";
import { FaunaVisualFactory } from "../../visual/mesh/FaunaVisualFactory";
import {
  TransformComponent,
  HealthBugComponent,
  StickySurfaceComponent,
  KinematicVelocityComponent,
  CollisionResponseComponent
} from "../../core/ecs/Components";

export interface PooledBug {
  entityId: EntityId;
  rootNode: BABYLON.TransformNode;
  active: boolean;
}

export class HealthBugPool {
  private bugPool: PooledBug[] = [];
  private readonly POOL_SIZE = 2;

  constructor(
    private context: SystemContext,
    private scene: BABYLON.Scene,
    private onOverlapCallback: (bugId: number, otherId: number) => void
  ) {
    this.initializePool();
  }

  private initializePool(): void {
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const bugId = this.context.world.create();

      const rootNode = FaunaVisualFactory.buildHealthBug(bugId, this.scene, "NORMAL");
      rootNode.setEnabled(false);
      rootNode.position.set(0, -999, 0);

      this.context.visualRegistration.registerTransformNode(bugId, rootNode);

      this.bugPool.push({
        entityId: bugId,
        rootNode,
        active: false
      });
    }
  }

  public acquire(
    startX: number,
    startY: number,
    calculatedPauseY: number,
    variant: "NORMAL" | "SPIKED_TOP" | "SPIKED_RIGHT" | "SPIKED_BOTTOM" | "SPIKED_LEFT"
  ): EntityId {
    const pBug = this.bugPool.find((p) => !p.active);
    if (!pBug) return -1;

    this.context.visualRegistration.unregisterTransformNode(pBug.entityId);
    pBug.rootNode.dispose();

    pBug.rootNode = FaunaVisualFactory.buildHealthBug(pBug.entityId, this.scene, variant);
    this.context.visualRegistration.registerTransformNode(pBug.entityId, pBug.rootNode);

    pBug.rootNode.position.set(startX, startY, 1.5);
    pBug.rootNode.setEnabled(true);

    this.context.stores.get<TransformComponent>("transform").add(pBug.entityId, {
      x: startX,
      y: startY,
      z: 1.5,
      qx: 0,
      qy: 0,
      qz: 0,
      qw: 1,
      prevX: startX,
      prevY: startY,
      prevZ: 1.5,
      prevQx: 0,
      prevQy: 0,
      prevQz: 0,
      prevQw: 1,
      scaleX: 1.0,
      scaleY: 1.0,
      scaleZ: 1.0,
      prevScaleX: 1.0,
      prevScaleY: 1.0,
      prevScaleZ: 1.0
    });

    this.context.stores.get<HealthBugComponent>("healthBug").add(pBug.entityId, {
      state: "FLYING_UP",
      variant,
      timer: 0.0,
      pauseDuration: 3.0 + Math.random() * 3.0,
      x: startX,
      y: startY,
      preInfluenceX: startX,
      preInfluenceY: calculatedPauseY + 14.0,
      preInfluenceState: "CONTINUING",
      isWebTrapped: false,
      isStuckOnWall: false,
      isStuckToBug: false,
      spikesDisarmed: false,
      rotorAngle: 0.0,
      pauseThresholdY: calculatedPauseY
    });

    this.context.stores.get<StickySurfaceComponent>("stickySurface").add(pBug.entityId, {
      isActive: true,
      width: 4.0,
      height: 4.0,
      speed: 0.0
    });

    this.context.stores.get<KinematicVelocityComponent>("velocity").add(pBug.entityId, {
      x: 0,
      y: 4.5,
      z: 0
    });

    this.context.stores.get<CollisionResponseComponent>("collisionResponse").add(pBug.entityId, {
      layer: "HAZARD",
      onOverlap: (otherId) => this.onOverlapCallback(pBug.entityId, otherId)
    });

    pBug.active = true;
    return pBug.entityId;
  }

  public release(bugId: EntityId): void {
    const pBug = this.bugPool.find((p) => p.entityId === bugId);
    if (!pBug) return;

    pBug.active = false;
    pBug.rootNode.setEnabled(false);
    pBug.rootNode.position.set(0, -999, 0);

    this.context.stores.get<HealthBugComponent>("healthBug").remove(bugId);
    this.context.stores.get<StickySurfaceComponent>("stickySurface").remove(bugId);
    this.context.stores.get<KinematicVelocityComponent>("velocity").remove(bugId);
    this.context.stores.get<CollisionResponseComponent>("collisionResponse").remove(bugId);

    const trans = this.context.stores.get<TransformComponent>("transform").get(bugId);
    if (trans) {
      trans.x = 0;
      trans.y = -999;
      trans.prevX = 0;
      trans.prevY = -999;
    }
  }

  public getActiveBugs(): PooledBug[] {
    return this.bugPool;
  }

  public reset(): void {
    for (let i = 0; i < this.bugPool.length; i++) {
      this.release(this.bugPool[i].entityId);
    }
  }

  public dispose(): void {
    this.reset();
    for (let i = 0; i < this.bugPool.length; i++) {
      this.context.visualRegistration.unregisterTransformNode(this.bugPool[i].entityId);
    }
    this.bugPool = [];
  }
}
