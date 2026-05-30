import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import {
  HitStopComponent,
  KinematicVelocityComponent,
  WeaverTraversalComponent,
  TransformComponent,
  KinematicTargetComponent,
  WeaverAIComponent,
  HealthComponent,
  WeaverSweepComponent,
  WeaverCosmeticComponent
} from "../../core/ecs/Components";
import { ARENA_CONFIG } from "../../core/engine/ArenaConfig";
import { GameEvent } from "../../core/events/GameEvents";
import { WeaverSweepHelper } from "./WeaverSweepHelper";
import { SpatialQueryService } from "../../physics/systems/SpatialQueryService";
import { ISpatialQueryService } from "../../contracts/ISpatialQuery";
import * as BABYLON from "@babylonjs/core";

export class WeaverTraversalSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;
  private queryService: ISpatialQueryService;

  constructor(private context: SystemContext) {
    this.queryService = new SpatialQueryService(this.context);
  }

  public update(dt: number): void {
    const hs = this.context.stores.get<HitStopComponent>("hitStop").get(this.context.refs.weaver);
    if (hs && hs.timeRemaining > 0) return;

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

    const scene = this.context.visualQuery.getScene();
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

      WeaverSweepHelper.updateSweepPhase(dt, sState, health, vel, trans);

      if (sState.phase === "SWEEP" || sState.phase === "LAUNCH") {
        let nextX = trans.x + vel.x * dt;
        let hitWallNormal = 0;

        if (concreteEngine && Math.abs(vel.x) > 0.001) {
          const castLength =
            ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.1, Math.abs(vel.x) * dt);

          const hitResult = this.queryService.castHorizontalRay(
            trans.x,
            trans.y,
            sState.direction,
            castLength
          );

          if (hitResult.hasHit) {
            const hitDistance = hitResult.hitDistance;
            if (
              hitDistance <=
              ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.01, Math.abs(vel.x) * dt)
            ) {
              hitWallNormal = Math.sign(hitResult.hitNormalX);
              nextX = hitResult.hitPointX - sState.direction * ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
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
        const dirX = Math.sign(vel.x);
        const castLength = ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.1, Math.abs(vel.x) * dt);

        const hitResult = this.queryService.castHorizontalRay(trans.x, target.y, dirX, castLength);

        if (hitResult.hasHit) {
          const hitDistance = hitResult.hitDistance;
          if (
            hitDistance <=
            ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.01, Math.abs(vel.x) * dt)
          ) {
            target.x = hitResult.hitPointX - dirX * ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
            if (vel.x * dirX > 0) vel.x = 0;
          }
        }
      }

      const castLengthDown =
        ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.1, Math.max(0, -vel.y) * dt);

      const floorHitResult = this.queryService.castVerticalRay(
        target.x,
        trans.y,
        -1,
        castLengthDown
      );

      if (floorHitResult.hasHit && !isStriking) {
        const hitDistance = floorHitResult.hitDistance;
        if (
          hitDistance <=
          ARENA_CONFIG.ENTITY.WEAVER_RADIUS + Math.max(0.01, Math.max(0, -vel.y) * dt)
        ) {
          isGrounded = true;
          target.y = floorHitResult.hitPointY + ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
          if (vel.y < 0) vel.y = 0;
        }
      }

      const wallClingResult = this.queryService.checkAabbWallCling(
        target.x,
        target.y,
        ARENA_CONFIG.ENTITY.WEAVER_RADIUS
      );
      isWallClinging = wallClingResult.isWallClinging;
      wallNormalX = wallClingResult.wallNormalX;
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
      } else if (target.y < floorLimit) {
        target.y = floorLimit;
        if (vel.y < 0) vel.y = 0;
        isGrounded = !isStriking;
      } else {
        const wallThreshold = wallLimitFallback - 0.2;
        if (Math.abs(target.x) >= wallThreshold) {
          isWallClinging = true;
          wallNormalX = target.x > 0 ? -1 : 1;
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

    const cosmeticStore = this.context.stores.get<WeaverCosmeticComponent>("weaverCosmetic");
    const cosmetic = cosmeticStore ? cosmeticStore.get(this.context.refs.weaver) : undefined;
    if (cosmetic && ai) {
      if (ai.state !== "DEFEATED") {
        if (trav.isWallClinging) {
          const breath = ai.state === "PATROLLING" ? Math.sin(ai.timeInState * 10.0) * 0.015 : 0.0;
          cosmetic.targetScaleX = 0.75 + breath;
          cosmetic.targetScaleY = 1.15 - breath * 0.5;
          cosmetic.targetScaleZ = 1.15 - breath * 0.5;
          cosmetic.wobbleAngle = 0.0;
          cosmetic.rotationAngle = 0.0;
        } else if (trav.isGrounded) {
          cosmetic.targetScaleY = 0.75;
          cosmetic.targetScaleX = 1.15;
          cosmetic.targetScaleZ = 1.15;
          cosmetic.wobbleAngle = 0.0;
          cosmetic.rotationAngle = 0.0;
        }
      }
    }
  }
}
