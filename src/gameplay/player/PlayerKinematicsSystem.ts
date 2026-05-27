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

    const dx = target.x - tether.anchorX;
    const dy = target.y - tether.anchorY;
    tether.currentLength = Math.sqrt(dx * dx + dy * dy) || 1.0;

    const reelConfig = GAMEPLAY_TUNING.REEL;

    if (input.y > 0) {
      tether.desiredLength -= reelConfig.IN_SPEED * dt;
      tether.reelHeat = Math.min(1.0, tether.reelHeat + dt * 1.2);
    } else if (input.y < 0) {
      tether.desiredLength += reelConfig.OUT_SPEED * dt;
      tether.reelHeat = Math.max(0.0, tether.reelHeat - dt * 1.5);
    } else {
      tether.reelHeat = Math.max(0.0, tether.reelHeat - dt * 0.8);
      const AUTO_SLACK_MARGIN = 2.0;
      tether.desiredLength = Math.min(
        tether.desiredLength,
        tether.currentLength + AUTO_SLACK_MARGIN
      );
    }
    tether.desiredLength = Math.max(
      reelConfig.MIN_LENGTH,
      Math.min(reelConfig.MAX_LENGTH, tether.desiredLength)
    );

    let easeSpeed = 0;
    if (tether.maxLength > tether.desiredLength) {
      const resistance = Math.max(0.1, 1.0 - tether.tension);
      easeSpeed = reelConfig.IN_SPEED * resistance;
      tether.reelVelocity = -easeSpeed;
    } else if (tether.maxLength < tether.desiredLength) {
      easeSpeed = reelConfig.OUT_SPEED;
      tether.reelVelocity = easeSpeed;
    } else {
      tether.reelVelocity = 0;
    }

    const maxDelta = easeSpeed * dt;
    if (Math.abs(tether.maxLength - tether.desiredLength) <= maxDelta) {
      tether.maxLength = tether.desiredLength;
    } else {
      tether.maxLength += Math.sign(tether.desiredLength - tether.maxLength) * maxDelta;
    }

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
        if (input.y > 0 && tether.isAttached) {
          const dx = tether.anchorX - target.x;
          const dy = tether.anchorY - target.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
          const pullForce = 15.0;
          vel.x += (dx / dist) * pullForce * dt;
          vel.y += (dy / dist) * pullForce * dt;
        }
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

    const finalDx = target.x - tether.anchorX;
    const finalDy = target.y - tether.anchorY;
    tether.currentLength = Math.sqrt(finalDx * finalDx + finalDy * finalDy) || 1.0;

    this.updateTensionMeter(dt, tether, trav, input);

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

    if (trav.state === "WALL_SLIDING") {
      const stillPressingIn = input.x === trav.wallDir;

      if (stillPressingIn === false) {
        this.triggerFling(vel, tether, target, trav);
        return;
      }

      target.x = trav.wallDir * this.WALL_LIMIT_X;

      vel.x = 0;
      vel.y = -currentScrollSpeed;
      
      let finalY = target.y + vel.y * dt;

      // Elongation: The maximum length of the rope can automatically increase while wall sliding.
      const dx = target.x - tether.anchorX;
      const dy = finalY - tether.anchorY;
      const requiredLength = Math.sqrt(dx * dx + dy * dy);

      if (input.y <= 0 && requiredLength > tether.maxLength) {
        const maxAllowed = GAMEPLAY_TUNING.REEL.MAX_LENGTH;
        if (tether.maxLength < maxAllowed) {
          tether.maxLength = Math.min(maxAllowed, requiredLength);
          tether.desiredLength = Math.max(tether.desiredLength, tether.maxLength);
        }
      }

      const limitY2 = tether.maxLength * tether.maxLength - dx * dx;
      if (limitY2 >= 0) {
        const minY = tether.anchorY - Math.sqrt(limitY2);
        if (finalY < minY) {
          finalY = minY;
          vel.y = 0;
        }
      }
      target.y = finalY;

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
        
        let finalY = target.y + vel.y * dt;

        // Elongation: The maximum length of the rope can automatically increase while wall sliding.
        const dx = target.x - tether.anchorX;
        const dy = finalY - tether.anchorY;
        const requiredLength = Math.sqrt(dx * dx + dy * dy);

        if (input.y <= 0 && requiredLength > tether.maxLength) {
          const maxAllowed = GAMEPLAY_TUNING.REEL.MAX_LENGTH;
          if (tether.maxLength < maxAllowed) {
            tether.maxLength = Math.min(maxAllowed, requiredLength);
            tether.desiredLength = Math.max(tether.desiredLength, tether.maxLength);
          }
        }

        const limitY2 = tether.maxLength * tether.maxLength - dx * dx;
        if (limitY2 >= 0) {
          const minY = tether.anchorY - Math.sqrt(limitY2);
          if (finalY < minY) {
            finalY = minY;
            vel.y = 0;
          }
        }
        target.y = finalY;
      } else {
        target.x = wallDir * this.WALL_LIMIT_X;
        target.y = nextY;
        if (Math.sign(vel.x) === wallDir) {
          vel.x *= -0.2;
        }
        trav.state = "AIRBORNE";
        trav.wallDir = 0;
      }
      return;
    }

    if (trav.state !== "LAUNCHING") {
      trav.state = "AIRBORNE";
    }
    trav.wallDir = 0;
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
    const reelConfig = GAMEPLAY_TUNING.REEL;

    if (storedTension < tuning.MIN_FLING_TENSION) {
      trav.state = "AIRBORNE";
      trav.wallDir = 0;
      trav.launchPower = 0;
      return;
    }

    const dx = tether.anchorX - target.x;
    const dy = tether.anchorY - target.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const tensionPower = Math.min(1.0, storedTension);
    const reelBonus = tether.reelVelocity < 0 ? Math.min(0.25, Math.abs(tether.reelVelocity) / 20.0) : 0;
    const isSweetSpot = storedTension >= reelConfig.SWEET_SPOT_MIN && storedTension <= reelConfig.SWEET_SPOT_MAX;
    const sweetSpotBonus = isSweetSpot ? 0.15 : 0.0;
    
    const powerScale = Math.min(1.0, tensionPower + reelBonus + sweetSpotBonus);
    const power = powerScale * tuning.FLING_IMPULSE;

    vel.x = (dx / dist) * power;
    vel.y = (dy / dist) * power;

    trav.state = "LAUNCHING";
    trav.launchTimer = tuning.LAUNCH_DURATION;
    trav.launchPower = powerScale;
    trav.wallDir = 0;

    let shakeAmp = 0.25 + powerScale * 0.35;
    let shakeDur = 0.2;

    if (storedTension >= CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT) {
      shakeAmp = 0.85;
      shakeDur = 0.45;
    } else if (isSweetSpot) {
      shakeAmp = 0.5;
      shakeDur = 0.28;
    }

    this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
      amplitude: shakeAmp,
      duration: shakeDur,
      dirX: dx / dist,
      dirY: dy / dist
    });
  }

  private enforcePendulumConstraint(
    target: KinematicTargetComponent,
    vel: KinematicVelocityComponent,
    tether: TetherComponent
  ) {
    const dx = target.x - tether.anchorX;
    const dy = target.y - tether.anchorY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;

    const activeMaxLength = tether.maxLength;

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

  private updateTensionMeter(
    dt: number,
    tether: TetherComponent,
    trav: TraversalStateComponent,
    input: InputIntentComponent
  ): void {
    const reelConfig = GAMEPLAY_TUNING.REEL;

    if (trav.state === "WALL_SLIDING") {
      let tensionDelta = reelConfig.WALL_SLIDE_PASSIVE_TENSION_RATE;

      if (input.y < 0) {
        tensionDelta -= reelConfig.REEL_OUT_TENSION_RELIEF;
      }

      tether.tension += tensionDelta * dt;

      // Stretch tension is only accumulated while wall sliding
      const TENSION_STRETCH_RANGE = 2.0;
      const stretch = Math.max(0, tether.currentLength - tether.maxLength);
      const stretchRatio = stretch / TENSION_STRETCH_RANGE;
      tether.tension += stretchRatio * dt;
    } else {
      // In any state other than WALL_SLIDING, tension decays back to 0
      tether.tension -= GAMEPLAY_TUNING.PLAYER.TENSION_DECAY_RATE * dt;
    }

    tether.tension = Math.max(
      0.0,
      Math.min(CANONICAL_UNITS.TETHER_STRAIN.SNAP_LIMIT, tether.tension)
    );
  }
}
