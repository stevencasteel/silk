import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
  TetherComponent,
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
import { CommandBus } from "../../core/commands/CommandBus";
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

  constructor(
    private refs: EntityRefs,
    private tethers: ComponentStore<TetherComponent>,
    private targets: ComponentStore<KinematicTargetComponent>,
    private traversal: ComponentStore<TraversalStateComponent>,
    private transforms: ComponentStore<TransformComponent>,
    private inputs: ComponentStore<InputIntentComponent>,
    private broker: EventBroker,
    private healths: ComponentStore<HealthComponent>,
    private commands: CommandBus
  ) {}

  public init(): void {
    this.commands.register<ApplyImpulseCommand>("APPLY_IMPULSE", (cmd) => {
      if (cmd.entityId === this.refs.player) {
        const tether = this.tethers.get(this.refs.player);
        if (tether) {
          tether.dynamicVelX += cmd.x;
          tether.dynamicVelY += cmd.y;
        }
      }
    });
  }

  public update(dt: number): void {
    const tether = this.tethers.get(this.refs.player);
    const target = this.targets.get(this.refs.player);
    const trav = this.traversal.get(this.refs.player);
    const wTrans = this.transforms.get(this.refs.weaver);
    const input = this.inputs.get(this.refs.player);

    if (!tether || !target || !trav || !wTrans || !input) return;

    const pHealth = this.healths.get(this.refs.player);
    const wHealth = this.healths.get(this.refs.weaver);

    if ((pHealth && pHealth.current <= 0) || (wHealth && wHealth.current <= 0)) {
      tether.dynamicVelX = 0;
      tether.dynamicVelY = 0;
      return;
    }

    tether.anchorX = wTrans.x;
    tether.anchorY = wTrans.y;
    tether.anchorZ = wTrans.z;

    let nextX = target.x;
    let nextY = target.y;

    const tuning = GAMEPLAY_TUNING.PLAYER;

    if (trav.state === "LAUNCHING") {
      trav.launchTimer -= dt;
      tether.dynamicVelX += input.x * tuning.LAUNCH_STEER_FORCE * dt;
      tether.dynamicVelY += this.GRAVITY * tuning.LAUNCH_GRAVITY_MULT * dt;

      const damp = Math.pow(tuning.DRAG_DAMPING, dt * CANONICAL_UNITS.TEMPORAL.LEGACY_FPS_BASIS);
      tether.dynamicVelX *= damp;
      tether.dynamicVelY *= damp;

      nextX += tether.dynamicVelX * dt;
      nextY += tether.dynamicVelY * dt;

      if (trav.launchTimer <= 0) {
        trav.state = "AIRBORNE";
        trav.wallDir = 0;
      }
    } else {
      tether.dynamicVelY += this.GRAVITY * dt;

      if (trav.state === "AIRBORNE") {
        tether.dynamicVelX += input.x * tuning.SWING_STEER_FORCE * dt;
      }

      const damp = Math.pow(tuning.DRAG_DAMPING, dt * CANONICAL_UNITS.TEMPORAL.LEGACY_FPS_BASIS);
      tether.dynamicVelX *= damp;
      tether.dynamicVelY *= damp;

      nextX += tether.dynamicVelX * dt;
      nextY += tether.dynamicVelY * dt;
    }

    this.resolveWallContact(nextX, nextY, dt, target, tether, trav, input);

    if (trav.state === "AIRBORNE" || trav.state === "LAUNCHING") {
      this.enforcePendulumConstraint(target, tether);
    }

    const dx = target.x - tether.anchorX;
    const dy = target.y - tether.anchorY;
    tether.currentLength = Math.sqrt(dx * dx + dy * dy) || 1.0;

    this.tensionPayload.tension = tether.tension;
    this.broker.publish(GameEvent.TETHER_TENSION_CHANGE, this.tensionPayload);

    this.lengthPayload.length = tether.currentLength;
    this.lengthPayload.maxLength = tether.maxLength;
    this.broker.publish(GameEvent.TETHER_LENGTH_CHANGE, this.lengthPayload);

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
    tether: TetherComponent,
    trav: TraversalStateComponent,
    input: InputIntentComponent
  ): void {
    const hitRight = nextX > this.WALL_LIMIT_X;
    const hitLeft = nextX < -this.WALL_LIMIT_X;
    const wallDir = hitRight ? 1 : hitLeft ? -1 : 0;
    const currentScrollSpeed = TransformSyncSystem.currentScrollSpeed;
    const tuning = GAMEPLAY_TUNING.PLAYER;

    if (trav.state === "WALL_SLIDING") {
      const stillPressingIn = input.x === trav.wallDir;

      if (!stillPressingIn) {
        this.triggerFling(tether, target, trav);
        return;
      }

      target.x = trav.wallDir * this.WALL_LIMIT_X;
      
      tether.dynamicVelX = 0;
      tether.dynamicVelY = -currentScrollSpeed;
      target.y = target.y + tether.dynamicVelY * dt;

      if (tether.tension < CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT) {
        tether.tension = Math.min(CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT, tether.tension + tuning.TENSION_CHARGE_RATE * dt);
      } else {
        const strainOverloadRate = (CANONICAL_UNITS.TETHER_STRAIN.SNAP_LIMIT - CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT) / CANONICAL_UNITS.TETHER_STRAIN.SNAP_DELAY_SECONDS;
        tether.tension = Math.min(CANONICAL_UNITS.TETHER_STRAIN.SNAP_LIMIT, tether.tension + strainOverloadRate * dt);
      }

      const maxStretch = this.MAX_TETHER_LENGTH - this.BASE_TETHER_LENGTH;
      tether.maxLength = this.BASE_TETHER_LENGTH + Math.min(CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT, tether.tension) * maxStretch;

      if (input.jump) {
        this.triggerFling(tether, target, trav);
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
          pTrans.scaleX = tuning.SQUASH_STRETCH.SQUASH_WALL_X;
          pTrans.scaleY = tuning.SQUASH_STRETCH.SQUASH_WALL_Y;
        }
        trav.state = "WALL_SLIDING";
        trav.wallDir = wallDir;
        trav.wallNormalX = -wallDir;
        trav.wallNormalY = 0;

        target.x = wallDir * this.WALL_LIMIT_X;
        
        tether.dynamicVelX = 0;
        tether.dynamicVelY = -currentScrollSpeed;
        target.y = target.y + tether.dynamicVelY * dt;

        if (tether.tension < CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT) {
          tether.tension = Math.min(CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT, tether.tension + tuning.TENSION_CHARGE_RATE * dt);
        } else {
          const strainOverloadRate = (CANONICAL_UNITS.TETHER_STRAIN.SNAP_LIMIT - CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT) / CANONICAL_UNITS.TETHER_STRAIN.SNAP_DELAY_SECONDS;
          tether.tension = Math.min(CANONICAL_UNITS.TETHER_STRAIN.SNAP_LIMIT, tether.tension + strainOverloadRate * dt);
        }

        const maxStretch = this.MAX_TETHER_LENGTH - this.BASE_TETHER_LENGTH;
        tether.maxLength = this.BASE_TETHER_LENGTH + Math.min(CANONICAL_UNITS.TETHER_STRAIN.OVERLOAD_LIMIT, tether.tension) * maxStretch;
      } else {
        target.x = wallDir * this.WALL_LIMIT_X;
        target.y = nextY;
        if (Math.sign(tether.dynamicVelX) === wallDir) {
          tether.dynamicVelX *= -0.2;
        }
        trav.state = "AIRBORNE";
        trav.wallDir = 0;
        tether.tension = Math.max(0, tether.tension - GAMEPLAY_TUNING.PLAYER.TENSION_DECAY_RATE * dt);
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
    tether.dynamicVelX = (dx / dist) * power;
    tether.dynamicVelY = (dy / dist) * power;

    trav.state = "LAUNCHING";
    trav.launchTimer = tuning.LAUNCH_DURATION;
    trav.launchPower = powerScale;
    trav.wallDir = 0;

    this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
      amplitude: 0.25 + powerScale * 0.35,
      duration: 0.2
    });
  }

  private enforcePendulumConstraint(target: KinematicTargetComponent, tether: TetherComponent): void {
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

      const dot = tether.dynamicVelX * nx + tether.dynamicVelY * ny;
      if (dot > 0) {
        tether.dynamicVelX -= dot * nx;
        tether.dynamicVelY -= dot * ny;
      }
    }
  }
}
