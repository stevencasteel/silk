import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
  SilkComponent,
  KinematicTargetComponent,
  TraversalStateComponent,
  TransformComponent,
  InputIntentComponent,
  HealthComponent
} from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { TransformSyncSystem } from "../../physics/sync/TransformSyncSystem";
import { ARENA_CONFIG, CANONICAL_UNITS } from "../../core/engine/ArenaConfig";

export class PlayerKinematicsSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;

  private readonly GRAVITY = CANONICAL_UNITS.GRAVITY.PLAYER_KINEMATIC;
  private readonly SWING_STEER_FORCE = 36.0;
  private readonly LAUNCH_STEER_FORCE = 16.0;

  private readonly BASE_SILK_LENGTH = ARENA_CONFIG.SILK.BASE_LENGTH;
  private readonly MAX_SILK_LENGTH = ARENA_CONFIG.SILK.MAX_LENGTH;

  private readonly WALL_LIMIT_X = ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;
  private readonly DRAG_DAMPING = 0.99;

  private readonly TENSION_CHARGE_RATE = 0.38;
  private readonly MIN_FLING_TENSION = 0.06;

  private readonly FLING_IMPULSE = 76.0;
  private readonly LAUNCH_DURATION = 0.7;
  private readonly LAUNCH_GRAVITY_MULT = 0.22;

  private lastTraversalState: string = "";
  private tensionPayload = { tension: 0.0 };
  private lengthPayload = { length: 0.0, maxLength: 0.0 };

  constructor(
    private refs: EntityRefs,
    private silks: ComponentStore<SilkComponent>,
    private targets: ComponentStore<KinematicTargetComponent>,
    private traversal: ComponentStore<TraversalStateComponent>,
    private transforms: ComponentStore<TransformComponent>,
    private inputs: ComponentStore<InputIntentComponent>,
    private broker: EventBroker,
    private healths: ComponentStore<HealthComponent>
  ) {}

  public update(dt: number): void {
    const silk = this.silks.get(this.refs.player);
    const target = this.targets.get(this.refs.player);
    const trav = this.traversal.get(this.refs.player);
    const wTrans = this.transforms.get(this.refs.weaver);
    const input = this.inputs.get(this.refs.player);

    if (!silk || !target || !trav || !wTrans || !input) return;

    const pTrans = this.transforms.get(this.refs.player);
    if (pTrans) {
      if (pTrans.scaleX === undefined || pTrans.scaleY === undefined || pTrans.scaleZ === undefined || pTrans.prevScaleX === undefined || pTrans.prevScaleY === undefined || pTrans.prevScaleZ === undefined) {
        pTrans.scaleX = 1.0;
        pTrans.scaleY = 1.0;
        pTrans.scaleZ = 1.0;
        pTrans.prevScaleX = 1.0;
        pTrans.prevScaleY = 1.0;
        pTrans.prevScaleZ = 1.0;
      }
      pTrans.prevScaleX = pTrans.scaleX;
      pTrans.prevScaleY = pTrans.scaleY;
      pTrans.prevScaleZ = pTrans.scaleZ;
    }

    const pHealth = this.healths.get(this.refs.player);
    const wHealth = this.healths.get(this.refs.weaver);

    if ((pHealth && pHealth.current <= 0) || (wHealth && wHealth.current <= 0)) {
      silk.dynamicVelX = 0;
      silk.dynamicVelY = 0;
      return;
    }

    silk.anchorX = wTrans.x;
    silk.anchorY = wTrans.y;
    silk.anchorZ = wTrans.z;

    let nextX = target.x;
    let nextY = target.y;

    if (trav.state === "LAUNCHING") {
      trav.launchTimer -= dt;
      silk.dynamicVelX += input.x * this.LAUNCH_STEER_FORCE * dt;
      silk.dynamicVelY += this.GRAVITY * this.LAUNCH_GRAVITY_MULT * dt;

      const damp = Math.pow(this.DRAG_DAMPING, dt * CANONICAL_UNITS.TEMPORAL.LEGACY_FPS_BASIS);
      silk.dynamicVelX *= damp;
      silk.dynamicVelY *= damp;

      nextX += silk.dynamicVelX * dt;
      nextY += silk.dynamicVelY * dt;

      if (trav.launchTimer <= 0) {
        trav.state = "AIRBORNE";
        trav.wallDir = 0;
      }
    } else {
      silk.dynamicVelY += this.GRAVITY * dt;

      if (trav.state === "AIRBORNE") {
        silk.dynamicVelX += input.x * this.SWING_STEER_FORCE * dt;
      }

      const damp = Math.pow(this.DRAG_DAMPING, dt * CANONICAL_UNITS.TEMPORAL.LEGACY_FPS_BASIS);
      silk.dynamicVelX *= damp;
      silk.dynamicVelY *= damp;

      nextX += silk.dynamicVelX * dt;
      nextY += silk.dynamicVelY * dt;
    }

    this.resolveWallContact(nextX, nextY, dt, target, silk, trav, input);

    if (trav.state === "AIRBORNE" || trav.state === "LAUNCHING") {
      this.enforcePendulumConstraint(target, silk);
    }

    const dx = target.x - silk.anchorX;
    const dy = target.y - silk.anchorY;
    silk.currentLength = Math.sqrt(dx * dx + dy * dy) || 1.0;

    this.tensionPayload.tension = silk.tension;
    this.broker.publish(GameEvent.SILK_TENSION_CHANGE, this.tensionPayload);

    this.lengthPayload.length = silk.currentLength;
    this.lengthPayload.maxLength = silk.maxLength;
    this.broker.publish(GameEvent.SILK_LENGTH_CHANGE, this.lengthPayload);

    if (pTrans) {
      let targetScaleX: number;
      let targetScaleY: number;
      let targetScaleZ: number;

      if (trav.state === "LAUNCHING") {
        const stretchFactor = 0.35 * trav.launchPower;
        targetScaleY = 1.0 + stretchFactor;
        targetScaleX = 1.0 - stretchFactor * 0.5;
        targetScaleZ = 1.0 - stretchFactor * 0.5;
      } else if (trav.state === "WALL_SLIDING") {
        targetScaleX = 0.75;
        targetScaleY = 1.15;
        targetScaleZ = 1.0;
      } else {
        const speed = Math.sqrt(silk.dynamicVelX * silk.dynamicVelX + silk.dynamicVelY * silk.dynamicVelY);
        const stretchFactor = Math.min(0.3, (speed / 30) * 0.3);
        targetScaleY = 1.0 + stretchFactor;
        targetScaleX = 1.0 - stretchFactor * 0.5;
        targetScaleZ = 1.0 - stretchFactor * 0.5;
      }

      const sx = pTrans.scaleX ?? 1.0;
      const sy = pTrans.scaleY ?? 1.0;
      const sz = pTrans.scaleZ ?? 1.0;

      pTrans.scaleX = sx + (targetScaleX - sx) * 15 * dt;
      pTrans.scaleY = sy + (targetScaleY - sy) * 15 * dt;
      pTrans.scaleZ = sz + (targetScaleZ - sz) * 15 * dt;
    }

    if (trav.state !== this.lastTraversalState) {
      this.lastTraversalState = trav.state;
      this.broker.publish(GameEvent.PLAYER_STATE_CHANGE, { state: trav.state });
    }
  }

  private resolveWallContact(
    nextX: number,
    nextY: number,
    dt: number,
    target: KinematicTargetComponent,
    silk: SilkComponent,
    trav: TraversalStateComponent,
    input: InputIntentComponent
  ): void {
    const hitRight = nextX > this.WALL_LIMIT_X;
    const hitLeft = nextX < -this.WALL_LIMIT_X;
    const wallDir = hitRight ? 1 : hitLeft ? -1 : 0;
    const currentScrollSpeed = TransformSyncSystem.currentScrollSpeed;

    if (trav.state === "WALL_SLIDING") {
      const stillPressingIn = input.x === trav.wallDir;

      if (!stillPressingIn) {
        this.triggerFling(silk, target, trav);
        return;
      }

      target.x = trav.wallDir * this.WALL_LIMIT_X;
      
      silk.dynamicVelX = 0;
      silk.dynamicVelY = -currentScrollSpeed;
      target.y = target.y + silk.dynamicVelY * dt;

      if (silk.tension < CANONICAL_UNITS.SILK_STRAIN.OVERLOAD_LIMIT) {
        silk.tension = Math.min(CANONICAL_UNITS.SILK_STRAIN.OVERLOAD_LIMIT, silk.tension + this.TENSION_CHARGE_RATE * dt);
      } else {
        const strainOverloadRate = (CANONICAL_UNITS.SILK_STRAIN.SNAP_LIMIT - CANONICAL_UNITS.SILK_STRAIN.OVERLOAD_LIMIT) / CANONICAL_UNITS.SILK_STRAIN.SNAP_DELAY_SECONDS;
        silk.tension = Math.min(CANONICAL_UNITS.SILK_STRAIN.SNAP_LIMIT, silk.tension + strainOverloadRate * dt);
      }

      const maxStretch = this.MAX_SILK_LENGTH - this.BASE_SILK_LENGTH;
      silk.maxLength = this.BASE_SILK_LENGTH + Math.min(CANONICAL_UNITS.SILK_STRAIN.OVERLOAD_LIMIT, silk.tension) * maxStretch;

      if (input.jump) {
        this.triggerFling(silk, target, trav);
        input.jump = false;
      }
      return;
    }

    if (wallDir !== 0) {
      const pressingIn = input.x === wallDir;

      if (pressingIn) {
        const pTrans = this.transforms.get(this.refs.player);
        this.broker.publish(GameEvent.PLAYER_WALL_HIT, {
          x: target.x,
          y: target.y,
          wallNormalX: -wallDir
        });
        if (pTrans) {
          pTrans.scaleX = 0.72;
          pTrans.scaleY = 1.22;
        }
        trav.state = "WALL_SLIDING";
        trav.wallDir = wallDir;
        trav.wallNormalX = -wallDir;
        trav.wallNormalY = 0;

        target.x = wallDir * this.WALL_LIMIT_X;
        
        silk.dynamicVelX = 0;
        silk.dynamicVelY = -currentScrollSpeed;
        target.y = target.y + silk.dynamicVelY * dt;

        if (silk.tension < CANONICAL_UNITS.SILK_STRAIN.OVERLOAD_LIMIT) {
          silk.tension = Math.min(CANONICAL_UNITS.SILK_STRAIN.OVERLOAD_LIMIT, silk.tension + this.TENSION_CHARGE_RATE * dt);
        } else {
          const strainOverloadRate = (CANONICAL_UNITS.SILK_STRAIN.SNAP_LIMIT - CANONICAL_UNITS.SILK_STRAIN.OVERLOAD_LIMIT) / CANONICAL_UNITS.SILK_STRAIN.SNAP_DELAY_SECONDS;
          silk.tension = Math.min(CANONICAL_UNITS.SILK_STRAIN.SNAP_LIMIT, silk.tension + strainOverloadRate * dt);
        }

        const maxStretch = this.MAX_SILK_LENGTH - this.BASE_SILK_LENGTH;
        silk.maxLength = this.BASE_SILK_LENGTH + Math.min(CANONICAL_UNITS.SILK_STRAIN.OVERLOAD_LIMIT, silk.tension) * maxStretch;
      } else {
        target.x = wallDir * this.WALL_LIMIT_X;
        target.y = nextY;
        if (Math.sign(silk.dynamicVelX) === wallDir) {
          silk.dynamicVelX *= -0.2;
        }
        trav.state = "AIRBORNE";
        trav.wallDir = 0;
        silk.tension = Math.max(0, silk.tension - 4.0 * dt);
      }
      return;
    }

    if (trav.state !== "LAUNCHING") {
      trav.state = "AIRBORNE";
    }
    trav.wallDir = 0;
    silk.tension = Math.max(0, silk.tension - 4.0 * dt);
    target.x = nextX;
    target.y = nextY;
  }

  private triggerFling(
    silk: SilkComponent,
    target: KinematicTargetComponent,
    trav: TraversalStateComponent
  ): void {
    const storedTension = silk.tension;
    silk.tension = 0.0;

    if (storedTension < this.MIN_FLING_TENSION) {
      trav.state = "AIRBORNE";
      trav.wallDir = 0;
      trav.launchPower = 0;
      return;
    }

    const dx = silk.anchorX - target.x;
    const dy = silk.anchorY - target.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const powerScale = Math.min(1.0, storedTension);
    const power = powerScale * this.FLING_IMPULSE;
    silk.dynamicVelX = (dx / dist) * power;
    silk.dynamicVelY = (dy / dist) * power;

    trav.state = "LAUNCHING";
    trav.launchTimer = this.LAUNCH_DURATION;
    trav.launchPower = powerScale;
    trav.wallDir = 0;

    this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
      amplitude: 0.25 + powerScale * 0.35,
      duration: 0.2
    });
  }

  private enforcePendulumConstraint(target: KinematicTargetComponent, silk: SilkComponent): void {
    const dx = target.x - silk.anchorX;
    const dy = target.y - silk.anchorY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;

    const activeMaxLength = Math.min(this.MAX_SILK_LENGTH, silk.maxLength);

    if (dist < activeMaxLength) {
      silk.maxLength = Math.max(this.BASE_SILK_LENGTH, dist);
    }

    if (dist > activeMaxLength) {
      const nx = dx / dist;
      const ny = dy / dist;

      target.x = silk.anchorX + nx * activeMaxLength;
      target.y = silk.anchorY + ny * activeMaxLength;

      const dot = silk.dynamicVelX * nx + silk.dynamicVelY * ny;
      if (dot > 0) {
        silk.dynamicVelX -= dot * nx;
        silk.dynamicVelY -= dot * ny;
      }
    }
  }
}
