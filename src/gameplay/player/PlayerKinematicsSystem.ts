import * as BABYLON from "@babylonjs/core";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { GameEvent } from "../../core/events/GameEvents";
import {
  TetherComponent,
  KinematicTargetComponent,
  TraversalStateComponent,
  TransformComponent,
  InputIntentComponent,
  HealthComponent,
  KinematicVelocityComponent
} from "../../core/ecs/Components";
import { ParallaxScrollSystem } from "../../visual/systems/ParallaxScrollSystem";
import { ApplyImpulseCommand } from "../../physics/commands/PhysicsCommands";
import { ARENA_CONFIG, CANONICAL_UNITS, GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";

export class PlayerKinematicsSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;

  private readonly GRAVITY = CANONICAL_UNITS.GRAVITY.PLAYER_KINEMATIC;
  private readonly BASE_TETHER_LENGTH = ARENA_CONFIG.TETHER.BASE_LENGTH;
  private readonly MAX_TETHER_LENGTH = ARENA_CONFIG.TETHER.MAX_LENGTH;
  private readonly WALL_LIMIT_X = ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;

  private lastTraversalState: string = "";
  private tensionPayload = { tension: 0.0 };
  private lengthPayload = { length: 0.0, maxLength: 0.0 };

  constructor(private context: SystemContext) {}

  public init(): void {
    this.context.commands.register<ApplyImpulseCommand>(
      "APPLY_IMPULSE",
      (cmd: ApplyImpulseCommand) => {
        if (cmd.entityId === this.context.refs.player) {
          const vel = this.context.stores
            .get<KinematicVelocityComponent>("velocity")
            .get(this.context.refs.player);
          if (vel) {
            vel.x += cmd.x;
            vel.y += cmd.y;
          }
        }
      }
    );
  }

  public update(dt: number): void {
    const tether = this.context.stores.get<TetherComponent>("tether").get(this.context.refs.player);
    const target = this.context.stores
      .get<KinematicTargetComponent>("target")
      .get(this.context.refs.player);
    const trav = this.context.stores
      .get<TraversalStateComponent>("traversal")
      .get(this.context.refs.player);
    const wTrans = this.context.stores
      .get<TransformComponent>("transform")
      .get(this.context.refs.weaver);
    const input = this.context.stores
      .get<InputIntentComponent>("input")
      .get(this.context.refs.player);
    const vel = this.context.stores
      .get<KinematicVelocityComponent>("velocity")
      .get(this.context.refs.player);

    if (!tether || !target || !trav || !wTrans || !input || !vel) return;

    const pHealth = this.context.stores
      .get<HealthComponent>("health")
      .get(this.context.refs.player);
    const wHealth = this.context.stores
      .get<HealthComponent>("health")
      .get(this.context.refs.weaver);

    if ((pHealth && pHealth.current <= 0) || (wHealth && wHealth.current <= 0)) {
      vel.x = 0;
      vel.y = 0;
      return;
    }

    const radius = ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
    const stingerTipLocal = new BABYLON.Vector3(0, -radius * 2.0, 0);
    const weaverQuat = new BABYLON.Quaternion(wTrans.qx, wTrans.qy, wTrans.qz, wTrans.qw);
    const stingerTipWorld = new BABYLON.Vector3();
    stingerTipLocal.rotateByQuaternionToRef(weaverQuat, stingerTipWorld);

    tether.anchorX = wTrans.x + stingerTipWorld.x;
    tether.anchorY = wTrans.y + stingerTipWorld.y;
    tether.anchorZ = wTrans.z + stingerTipWorld.z;

    let nextX = target.x;
    let nextY = target.y;

    const tuning = GAMEPLAY_TUNING.PLAYER;

    if (trav.state === "LAUNCHING") {
      trav.launchTimer -= dt;
      vel.x += input.x * tuning.LAUNCH_STEER_FORCE * dt;
      vel.y += this.GRAVITY * tuning.LAUNCH_GRAVITY_MULT * dt;

      const damp = Math.pow(tuning.DRAG_DAMPING, dt * CANONICAL_UNITS.TEMPORAL.LEGACY_FPS_BASIS);
      vel.x *= damp;
      vel.y *= damp;

      nextX += vel.x * dt;
      nextY += vel.y * dt;

      if (trav.launchTimer <= 0) {
        trav.state = "AIRBORNE";
        trav.wallDir = 0;
      }
    } else {
      vel.y += this.GRAVITY * dt;

      if (trav.state === "AIRBORNE") {
        vel.x += input.x * tuning.SWING_STEER_FORCE * dt;
      }

      const damp = Math.pow(tuning.DRAG_DAMPING, dt * CANONICAL_UNITS.TEMPORAL.LEGACY_FPS_BASIS);
      vel.x *= damp;
      vel.y *= damp;

      nextX += vel.x * dt;
      nextY += vel.y * dt;
    }

    this.resolveWallContact(nextX, nextY, dt, target, vel, tether, trav, input);

    if (trav.state === "AIRBORNE" || trav.state === "LAUNCHING") {
      this.enforcePendulumConstraint(target, vel, tether);
    }

    const dx = target.x - tether.anchorX;
    const dy = target.y - tether.anchorY;
    tether.currentLength = Math.sqrt(dx * dx + dy * dy) || 1.0;

    this.tensionPayload.tension = tether.tension;
    this.context.broker.publish(GameEvent.TETHER_TENSION_CHANGE, this.tensionPayload);

    this.lengthPayload.length = tether.currentLength;
    this.lengthPayload.maxLength = tether.maxLength;
    this.context.broker.publish(GameEvent.TETHER_LENGTH_CHANGE, this.lengthPayload);

    if (trav.state !== this.lastTraversalState) {
      this.lastTraversalState = trav.state;
      this.context.broker.publish(GameEvent.PLAYER_STATE_CHANGE, { state: trav.state });
    }
  }

  private resolveWallContact(
    nextX: number,
    nextY: number,
    dt: number,
    target: KinematicTargetComponent,
    vel: KinematicVelocityComponent,
    tether: TetherComponent,
    trav: TraversalStateComponent,
    input: InputIntentComponent
  ): void {
    const hitRight = nextX > this.WALL_LIMIT_X;
    const hitLeft = nextX < -this.WALL_LIMIT_X;
    const wallDir = hitRight ? 1 : hitLeft ? -1 : 0;
    const currentScrollSpeed = ParallaxScrollSystem.currentScrollSpeed;
    const tuning = GAMEPLAY_TUNING.PLAYER;

    if (trav.state === "WALL_SLIDING") {
      const stillPressingIn = input.x === trav.wallDir;

      if (!stillPressingIn) {
        this.triggerFling(vel, tether, target, trav);
        return;
      }

      target.x = trav.wallDir * this.WALL_LIMIT_X;

      vel.x = 0;
      vel.y = -currentScrollSpeed;
      target.y = target.y + vel.y * dt;

      if (currentScrollSpeed > 0) {
        if (tether.tension < CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT) {
          tether.tension = Math.min(
            CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT,
            tether.tension + tuning.TENSION_CHARGE_RATE * dt
          );
        } else {
          const strainOverloadRate =
            (CANONICAL_UNITS.TETHER_STRAIN.SNAP_LIMIT -
              CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT) /
            CANONICAL_UNITS.TETHER_STRAIN.SNAP_DELAY_SECONDS;
          tether.tension = Math.min(
            CANONICAL_UNITS.TETHER_STRAIN.SNAP_LIMIT,
            tether.tension + strainOverloadRate * dt
          );
        }
      }

      const maxStretch = this.MAX_TETHER_LENGTH - this.BASE_TETHER_LENGTH;
      tether.maxLength =
        this.BASE_TETHER_LENGTH +
        Math.min(CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT, tether.tension) * maxStretch;

      if (input.jump) {
        this.triggerFling(vel, tether, target, trav);
        input.jump = false;
      }
      return;
    }

    if (wallDir !== 0) {
      const pressingIn = input.x === wallDir;

      if (pressingIn) {
        const transforms = this.context.stores.get<TransformComponent>("transform");
        const pTrans = transforms.get(this.context.refs.player);
        this.context.broker.publish(GameEvent.PLAYER_WALL_HIT, {
          x: target.x,
          y: target.y,
          wallNormalX: -wallDir
        });
        if (pTrans) {
          if (pTrans.scaleVelX === undefined) pTrans.scaleVelX = 0;
          if (pTrans.scaleVelY === undefined) pTrans.scaleVelY = 0;
          if (pTrans.scaleVelZ === undefined) pTrans.scaleVelZ = 0;
          pTrans.scaleVelX += -10.0;
          pTrans.scaleVelY += 12.0;
          pTrans.scaleVelZ += -2.0;
        }
        trav.state = "WALL_SLIDING";
        trav.wallDir = wallDir;
        trav.wallNormalX = -wallDir;
        trav.wallNormalY = 0;

        target.x = wallDir * this.WALL_LIMIT_X;

        vel.x = 0;
        vel.y = -currentScrollSpeed;
        target.y = target.y + vel.y * dt;

        if (currentScrollSpeed > 0) {
          if (tether.tension < CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT) {
            tether.tension = Math.min(
              CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT,
              tether.tension + tuning.TENSION_CHARGE_RATE * dt
            );
          } else {
            const strainOverloadRate =
              (CANONICAL_UNITS.TETHER_STRAIN.SNAP_LIMIT -
                CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT) /
              CANONICAL_UNITS.TETHER_STRAIN.SNAP_DELAY_SECONDS;
            tether.tension = Math.min(
              CANONICAL_UNITS.TETHER_STRAIN.SNAP_LIMIT,
              tether.tension + strainOverloadRate * dt
            );
          }
        }

        const maxStretch = this.MAX_TETHER_LENGTH - this.BASE_TETHER_LENGTH;
        tether.maxLength =
          this.BASE_TETHER_LENGTH +
          Math.min(CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT, tether.tension) * maxStretch;
      } else {
        target.x = wallDir * this.WALL_LIMIT_X;
        target.y = nextY;
        if (Math.sign(vel.x) === wallDir) {
          vel.x *= -0.2;
        }
        trav.state = "AIRBORNE";
        trav.wallDir = 0;
        tether.tension = Math.max(
          0,
          tether.tension - GAMEPLAY_TUNING.PLAYER.TENSION_DECAY_RATE * dt
        );
      }
      return;
    }

    if (trav.state !== "LAUNCHING") {
      trav.state = "AIRBORNE";
    }
    trav.wallDir = 0;
    tether.tension = Math.max(0, tether.tension - GAMEPLAY_TUNING.PLAYER.TENSION_DECAY_RATE * dt);
    target.x = nextX;
    target.y = nextY;
  }

  private triggerFling(
    vel: KinematicVelocityComponent,
    tether: TetherComponent,
    target: KinematicTargetComponent,
    trav: TraversalStateComponent
  ): void {
    const storedTension = tether.tension;
    tether.tension = 0.0;
    const tuning = GAMEPLAY_TUNING.PLAYER;

    if (storedTension < tuning.MIN_FLING_TENSION) {
      trav.state = "AIRBORNE";
      trav.wallDir = 0;
      trav.launchPower = 0;
      return;
    }

    const dx = tether.anchorX - target.x;
    const dy = tether.anchorY - target.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const powerScale = Math.min(1.0, storedTension);
    const power = powerScale * tuning.FLING_IMPULSE;
    vel.x = (dx / dist) * power;
    vel.y = (dy / dist) * power;

    trav.state = "LAUNCHING";
    trav.launchTimer = tuning.LAUNCH_DURATION;
    trav.launchPower = powerScale;
    trav.wallDir = 0;

    this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
      amplitude: 0.25 + powerScale * 0.35,
      duration: 0.2
    });
  }

  private enforcePendulumConstraint(
    target: KinematicTargetComponent,
    vel: KinematicVelocityComponent,
    tether: TetherComponent
  ): void {
    const dx = target.x - tether.anchorX;
    const dy = target.y - tether.anchorY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;

    const activeMaxLength = Math.min(this.MAX_TETHER_LENGTH, tether.maxLength);

    if (dist < activeMaxLength) {
      tether.maxLength = Math.max(this.BASE_TETHER_LENGTH, dist);
    }

    if (dist > activeMaxLength) {
      const nx = dx / dist;
      const ny = dy / dist;

      target.x = tether.anchorX + nx * activeMaxLength;
      target.y = tether.anchorY + ny * activeMaxLength;

      const dot = vel.x * nx + vel.y * ny;
      if (dot > 0) {
        vel.x -= dot * nx;
        vel.y -= dot * ny;
      }
    }
  }
}
