import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  KinematicVelocityComponent,
  WeaverTraversalComponent,
  TransformComponent,
  KinematicTargetComponent,
  WeaverAIComponent,
  HealthComponent,
  WeaverSweepComponent
} from "../../core/ecs/Components";
import { ARENA_CONFIG } from "../../core/engine/ArenaConfig";
import { GameEvent } from "../../core/events/GameEvents";
import { WeaverSweepHelper } from "./WeaverSweepHelper";
import * as BABYLON from "@babylonjs/core";

export class WeaverTraversalSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;

  private readonly _raycastResult = new BABYLON.PhysicsRaycastResult();
  private readonly _rayStart = new BABYLON.Vector3();
  private readonly _rayEnd = new BABYLON.Vector3();

  constructor(private context: SystemContext) {}

  public update(dt: number): void {
    const vel = this.context.stores
      .get<KinematicVelocityComponent>("velocity")
      .get(this.context.refs.weaver);
    const trav = this.context.stores
      .get<WeaverTraversalComponent>("weaverTraversal")
      .get(this.context.refs.weaver);
    const trans = this.context.stores
      .get<TransformComponent>("transform")
      .get(this.context.refs.weaver);
    const target = this.context.stores
      .get<KinematicTargetComponent>("target")
      .get(this.context.refs.weaver);
    const ai = this.context.stores.get<WeaverAIComponent>("weaverAI").get(this.context.refs.weaver);
    const health = this.context.stores.get<HealthComponent>("health").get(this.context.refs.weaver);
    const sweepStore = this.context.stores.get<WeaverSweepComponent>("weaverSweep");

    if (!vel || !trav || !trans || !target) return;

    const isStriking = ai && ai.state === "STRIKING";
    const isPatrolling = ai && ai.state === "PATROLLING";
    let sState = sweepStore.get(this.context.refs.weaver);

    const scene = this.context.visualRegistry.getScene();
    const physicsEngine = scene?.getPhysicsEngine();
    const concreteEngine = physicsEngine ? (physicsEngine as BABYLON.PhysicsEngine) : null;

    if (isPatrolling) {
      if (!sState) {
        const dir = vel.x >= 0 ? 1 : -1;
        sState = {
          phase: "SWEEP",
          timer: 0.0,
          direction: dir
        };
        sweepStore.add(this.context.refs.weaver, sState);
      }

      // Delegate state transition rules to the helper
      WeaverSweepHelper.updateSweepPhase(dt, sState, health, vel, trans);

      if (sState.phase === "SWEEP" || sState.phase === "LAUNCH") {
        let nextX = trans.x + vel.x * dt;
        let hitWallNormal = 0;

        if (concreteEngine && Math.abs(vel.x) > 0.001) {
          this._rayStart.set(trans.x, trans.y, 0);
          const castLength =
            ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.1, Math.abs(vel.x) * dt);
          this._rayEnd.set(trans.x + sState.direction * castLength, trans.y, 0);

          concreteEngine.raycastToRef(this._rayStart, this._rayEnd, this._raycastResult);

          if (this._raycastResult.hasHit && this._raycastResult.body) {
            const hitDistance = this._raycastResult.hitDistance;
            if (
              hitDistance <=
              ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.01, Math.abs(vel.x) * dt)
            ) {
              hitWallNormal = Math.sign(this._raycastResult.hitNormalWorld.x);
              nextX =
                this._raycastResult.hitPointWorld.x -
                sState.direction * ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
            }
          }
        } else {
          const fallbackLimit =
            ARENA_CONFIG.HORIZONTAL.PLAY_AREA_HALF_WIDTH - ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
          if (nextX >= fallbackLimit) {
            nextX = fallbackLimit;
            hitWallNormal = -1;
          } else if (nextX <= -fallbackLimit) {
            nextX = -fallbackLimit;
            hitWallNormal = 1;
          }
        }

        if (hitWallNormal !== 0) {
          this.context.broker.publish(GameEvent.WEAVER_WALL_HIT, {
            x: nextX,
            y: trans.y,
            wallNormalX: hitWallNormal
          });

          // Delegate wall impact scaling impulses and direction changes
          WeaverSweepHelper.handleWallImpact(sState, vel, trans, hitWallNormal);
        }

        target.x = nextX;
        target.y = ARENA_CONFIG.VERTICAL.WEAVER_CEILING_Y;
        target.active = true;
      } else if (sState.phase === "HOLD") {
        target.y = ARENA_CONFIG.VERTICAL.WEAVER_CEILING_Y;
        target.active = true;
      }
    } else {
      target.x = trans.x + vel.x * dt;
      target.y = trans.y + vel.y * dt;
      target.active = true;
      sweepStore.remove(this.context.refs.weaver);
    }

    let isGrounded = false;
    let isWallClinging = false;
    let wallNormalX = 0;

    if (concreteEngine) {
      if (Math.abs(vel.x) > 0.01) {
        this._rayStart.set(trans.x, target.y, 0);
        const dirX = Math.sign(vel.x);
        const castLength = ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.1, Math.abs(vel.x) * dt);
        this._rayEnd.set(trans.x + dirX * castLength, target.y, 0);

        concreteEngine.raycastToRef(this._rayStart, this._rayEnd, this._raycastResult);

        if (this._raycastResult.hasHit && this._raycastResult.body) {
          const hitDistance = this._raycastResult.hitDistance;
          if (
            hitDistance <=
            ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.01, Math.abs(vel.x) * dt)
          ) {
            target.x =
              this._raycastResult.hitPointWorld.x - dirX * ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
            if (vel.x * dirX > 0) vel.x = 0;
          }
        }
      }

      this._rayStart.set(target.x, trans.y, 0);
      const castLengthDown =
        ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.1, Math.max(0, -vel.y) * dt);
      this._rayEnd.set(target.x, trans.y - castLengthDown, 0);

      concreteEngine.raycastToRef(this._rayStart, this._rayEnd, this._raycastResult);

      if (this._raycastResult.hasHit && this._raycastResult.body && !isStriking) {
        const hitDistance = this._raycastResult.hitDistance;
        if (
          hitDistance <=
          ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.01, Math.max(0, -vel.y) * dt)
        ) {
          isGrounded = true;
          target.y = this._raycastResult.hitPointWorld.y + ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
          if (vel.y < 0) vel.y = 0;
        }
      }

      const wallCheckDist = ARENA_CONFIG.ENTITY.WEAVER_RADIUS + 0.15;
      this._rayStart.set(target.x, target.y, 0);

      this._rayEnd.set(target.x - wallCheckDist, target.y, 0);
      concreteEngine.raycastToRef(this._rayStart, this._rayEnd, this._raycastResult);

      if (this._raycastResult.hasHit && this._raycastResult.body) {
        isWallClinging = true;
        wallNormalX = 1;
      } else {
        this._rayEnd.set(target.x + wallCheckDist, target.y, 0);
        concreteEngine.raycastToRef(this._rayStart, this._rayEnd, this._raycastResult);
        if (this._raycastResult.hasHit && this._raycastResult.body) {
          isWallClinging = true;
          wallNormalX = -1;
        }
      }
    } else {
      const wallLimitFallback =
        ARENA_CONFIG.HORIZONTAL.PLAY_AREA_HALF_WIDTH - ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
      if (target.x > wallLimitFallback && (!sState || sState.phase !== "HOLD")) {
        target.x = wallLimitFallback;
        if (vel.x > 0) vel.x = 0;
      } else if (target.x < -wallLimitFallback && (!sState || sState.phase !== "HOLD")) {
        target.x = -wallLimitFallback;
        if (vel.x < 0) vel.x = 0;
      }

      const ceilingLimit = ARENA_CONFIG.VERTICAL.CEILING_Y;
      const floorLimit = isStriking
        ? ARENA_CONFIG.VERTICAL.FLOOR_Y - 70.0
        : ARENA_CONFIG.VERTICAL.FLOOR_Y;
      if (target.y > ceilingLimit) {
        target.y = ceilingLimit;
        if (vel.y > 0) vel.y = 0;
        isGrounded = false;
        isWallClinging = false;
      } else if (target.y < floorLimit) {
        target.y = floorLimit;
        if (vel.y < 0) vel.y = 0;
        isGrounded = !isStriking;
        isWallClinging = false;
      } else {
        isGrounded = false;
        const wallThreshold = wallLimitFallback - 0.2;
        if (Math.abs(target.x) >= wallThreshold) {
          isWallClinging = true;
          wallNormalX = target.x > 0 ? -1 : 1;
        } else {
          isWallClinging = false;
          wallNormalX = 0;
        }
      }
    }

    trav.isGrounded = isGrounded;
    trav.isWallClinging = isWallClinging;
    trav.wallNormalX = wallNormalX;

    if (trans) {
      if (isPatrolling && sState && sState.phase === "HOLD") {
        target.x = sState.direction * (ARENA_CONFIG.ENTITY.WEAVER_RADIUS - 15.0);
      }
    }
  }
}
