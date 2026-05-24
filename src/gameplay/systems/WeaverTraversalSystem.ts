import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
  KinematicVelocityComponent,
  WeaverTraversalComponent,
  TransformComponent,
  KinematicTargetComponent,
  WeaverAIComponent,
  HealthComponent
} from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { ARENA_CONFIG } from "../../core/engine/ArenaConfig";

export class WeaverTraversalSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;
  private minX = ARENA_CONFIG.HORIZONTAL.WEAVER_PATROL_MIN_X;
  private maxX = ARENA_CONFIG.HORIZONTAL.WEAVER_PATROL_MAX_X;

  constructor(
    private refs: EntityRefs,
    private velocities: ComponentStore<KinematicVelocityComponent>,
    private traversal: ComponentStore<WeaverTraversalComponent>,
    private transforms: ComponentStore<TransformComponent>,
    private targets: ComponentStore<KinematicTargetComponent>,
    private aiStore: ComponentStore<WeaverAIComponent>,
    private healths: ComponentStore<HealthComponent>
  ) {}

  public update(dt: number): void {
    const vel = this.velocities.get(this.refs.weaver);
    const trav = this.traversal.get(this.refs.weaver);
    const trans = this.transforms.get(this.refs.weaver);
    const target = this.targets.get(this.refs.weaver);
    const ai = this.aiStore.get(this.refs.weaver);
    const health = this.healths.get(this.refs.weaver);

    if (!vel || !trav || !trans || !target) return;

    const isSweeping = !ai || ai.state === "SWEEPING";
    if (isSweeping) {
      let nextX = trans.x + vel.x * dt;
      const isBerserk = health ? health.current < health.max * 0.5 : false;
      const sweepSpeed = isBerserk ? 9.0 : 4.5;
      if (nextX >= this.maxX) {
        nextX = this.maxX;
        vel.x = -sweepSpeed;
      } else if (nextX <= this.minX) {
        nextX = this.minX;
        vel.x = sweepSpeed;
      }
      target.x = nextX;
      target.y = ARENA_CONFIG.VERTICAL.WEAVER_CEILING_Y;
      target.active = true;
      trav.velX = vel.x;
      trav.velY = 0;
    } else {
      target.x = trans.x + vel.x * dt;
      target.y = trans.y + vel.y * dt;
      target.active = true;
      trav.velX = vel.x;
      trav.velY = vel.y;
    }

    const wallLimit = ARENA_CONFIG.HORIZONTAL.WEAVER_LIMIT_X;
    if (target.x > wallLimit) {
      target.x = wallLimit;
      if (vel.x > 0) vel.x = 0;
    } else if (target.x < -wallLimit) {
      target.x = -wallLimit;
      if (vel.x < 0) vel.x = 0;
    }

    const ceilingLimit = ARENA_CONFIG.VERTICAL.CEILING_Y;
    const floorLimit = ARENA_CONFIG.VERTICAL.FLOOR_Y;
    if (target.y > ceilingLimit) {
      target.y = ceilingLimit;
      if (vel.y > 0) vel.y = 0;
      trav.isGrounded = false;
      trav.isWallClinging = false;
    } else if (target.y < floorLimit) {
      target.y = floorLimit;
      if (vel.y < 0) vel.y = 0;
      trav.isGrounded = true;
      trav.isWallClinging = false;
    } else {
      trav.isGrounded = false;
      const wallThreshold = ARENA_CONFIG.HORIZONTAL.WALL_CLING_THRESHOLD_X;
      if (Math.abs(target.x) >= wallThreshold) {
        trav.isWallClinging = true;
        trav.wallNormalX = target.x > 0 ? -1 : 1;
      } else {
        trav.isWallClinging = false;
        trav.wallNormalX = 0;
      }
    }

    if (trans) {
      if (trans.scaleX === undefined || trans.scaleY === undefined || trans.scaleZ === undefined || trans.prevScaleX === undefined || trans.prevScaleY === undefined || trans.prevScaleZ === undefined) {
        trans.scaleX = 1.0;
        trans.scaleY = 1.0;
        trans.scaleZ = 1.0;
        trans.prevScaleX = 1.0;
        trans.prevScaleY = 1.0;
        trans.prevScaleZ = 1.0;
      }
      trans.prevScaleX = trans.scaleX;
      trans.prevScaleY = trans.scaleY;
      trans.prevScaleZ = trans.scaleZ;

      let targetScaleX = 1.0;
      let targetScaleY = 1.0;
      let targetScaleZ = 1.0;

      if (ai) {
        if (ai.state === "SWEEPING") {
          const pulse = Math.sin(ai.timeInState * 3.5) * 0.04;
          targetScaleX = 1.0 + pulse;
          targetScaleY = 1.0 - pulse;
        } else if (ai.state === "DASHING") {
          const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
          if (speed < 0.1) {
            targetScaleY = 0.82;
            targetScaleX = 1.15;
            targetScaleZ = 1.15;
          } else {
            const stretch = Math.min(0.25, (speed / 36.0) * 0.25);
            targetScaleY = 1.0 + stretch;
            targetScaleX = 1.0 - stretch * 0.5;
            targetScaleZ = 1.0 - stretch * 0.5;
          }
        } else if (ai.state === "RETURNING") {
          targetScaleY = 1.08;
          targetScaleX = 0.96;
        } else if (ai.state === "DEFEATED") {
          targetScaleX = 0.2;
          targetScaleY = 0.2;
          targetScaleZ = 0.2;
        }
      }

      const sx = trans.scaleX ?? 1.0;
      const sy = trans.scaleY ?? 1.0;
      const sz = trans.scaleZ ?? 1.0;

      trans.scaleX = sx + (targetScaleX - sx) * 12 * dt;
      trans.scaleY = sy + (targetScaleY - sy) * 12 * dt;
      trans.scaleZ = sz + (targetScaleZ - sz) * 12 * dt;
    }
  }
}
