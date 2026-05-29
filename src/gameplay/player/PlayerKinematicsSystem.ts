import { getWeaverStingerTip, getDistance2D } from "../../core/utils/EngineUtils";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { GameEvent } from "../../core/events/GameEvents";
import {
  TetherComponent,
  KinematicTargetComponent,
  TraversalStateComponent,
  TransformComponent,
  HealthComponent,
  KinematicVelocityComponent,
  InputIntentComponent,
  ParticleRequestComponent
} from "../../core/ecs/Components";
import { ApplyImpulseCommand } from "../../physics/commands/PhysicsCommands";
import { IPlayerState } from "./IPlayerState";
import { PlayerStateUtils } from "./states/PlayerStateUtils";
import { ARENA_CONFIG, CANONICAL_UNITS, GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";
import { WebSplatStrategy } from "../juice/ParticleStrategies";

export class PlayerKinematicsSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;

  private states = new Map<string, IPlayerState>();
  private lastTraversalState: string = "";
  private tensionPayload = { tension: 0.0 };
  private lengthPayload = { length: 0.0, maxLength: 0.0 };

  constructor(private context: SystemContext) {}

  public registerState(state: IPlayerState): void {
    this.states.set(state.type, state);
  }

  public init(): void {
    this.context.commands.register("APPLY_IMPULSE", (cmd: unknown) => {
      const impulseCmd = cmd as ApplyImpulseCommand;
      if (impulseCmd.entityId === this.context.refs.player) {
        const vel = this.context.stores
          .get<KinematicVelocityComponent>("velocity")
          .get(this.context.refs.player);
        if (vel) {
          vel.x += impulseCmd.x;
          vel.y += impulseCmd.y;
        }
      }
    });
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
    const vel = this.context.stores
      .get<KinematicVelocityComponent>("velocity")
      .get(this.context.refs.player);

    if (!tether || !target || !trav || !wTrans || !vel) return;

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
    const tipWorld = getWeaverStingerTip(
      wTrans.x,
      wTrans.y,
      wTrans.z,
      wTrans.qx,
      wTrans.qy,
      wTrans.qz,
      wTrans.qw,
      radius,
      1.18
    );
    tether.anchorX = tipWorld.x;
    tether.anchorY = tipWorld.y;
    tether.anchorZ = tipWorld.z;

    tether.currentLength = getDistance2D(target.x, target.y, tether.anchorX, tether.anchorY);

    // Trap & Struggle Detection
    const input = this.context.stores.get<InputIntentComponent>("input").get(this.context.refs.player);
    if (trav.isWebTrapped && input) {
      let currentDir: "UP" | "DOWN" | "LEFT" | "RIGHT" | "" = "";
      if (input.x < -0.1) currentDir = "LEFT";
      else if (input.x > 0.1) currentDir = "RIGHT";
      else if (input.y > 0.1) currentDir = "UP";
      else if (input.y < -0.1) currentDir = "DOWN";

      if (currentDir !== "" && currentDir !== trav.lastEscapeDirection) {
        trav.escapeProgress = (trav.escapeProgress || 0) + 1;
        trav.lastEscapeDirection = currentDir;

        // Visual / Audio shake on registration
        this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
          amplitude: 0.18,
          duration: 0.12
        });

        const reqStore = this.context.stores.get<ParticleRequestComponent>("particleRequest");
        if (reqStore) {
          const reqId = this.context.world.create();
          reqStore.add(reqId, {
            strategy: new WebSplatStrategy(),
            x: target.x,
            y: target.y,
            z: 0
          });
        }

        // Custom window struggle dispatch
        window.dispatchEvent(
          new CustomEvent("silk-web-struggle", {
            detail: { progress: trav.escapeProgress, required: trav.escapeRequired, direction: currentDir }
          })
        );

        if (trav.escapeProgress >= (trav.escapeRequired || 5)) {
          trav.isWebTrapped = false;
          trav.escapeProgress = 0;
          trav.lastEscapeDirection = "";
          trav.safeLaunchTimer = 1.5;

          // Apply Fling Bonus if escaping directly while attached to wall
          if (trav.state === "WALL_SLIDING") {
            trav.hasFlingBonus = true;
          }

          // Visual pop scale burst via spring-damper values
          const pTrans = this.context.stores.get<TransformComponent>("transform").get(this.context.refs.player);
          if (pTrans) {
            pTrans.scaleX = 1.4;
            pTrans.scaleY = 1.4;
            pTrans.scaleZ = 1.4;
          }

          // Escape blast particles
          this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
            amplitude: 0.8,
            duration: 0.45
          });
          if (reqStore) {
            for (let i = 0; i < 4; i++) {
              const reqId = this.context.world.create();
              reqStore.add(reqId, {
                strategy: new WebSplatStrategy(),
                x: target.x,
                y: target.y,
                z: 0
              });
            }
          }

          window.dispatchEvent(new CustomEvent("silk-web-break"));
        }
      }
    }

    if (trav.safeLaunchTimer !== undefined && trav.safeLaunchTimer > 0) {
      trav.safeLaunchTimer = Math.max(0, trav.safeLaunchTimer - dt);
    }

    const stateObj = this.states.get(trav.state);
    if (stateObj) {
      const nextState = stateObj.update(this.context, dt);
      if (nextState) {
        trav.state = nextState;
      }
    }

    if (trav.state === "AIRBORNE" || trav.state === "LAUNCHING") {
      PlayerStateUtils.enforcePendulumConstraint(target, vel, tether);
    }

    tether.currentLength = getDistance2D(target.x, target.y, tether.anchorX, tether.anchorY);

    this.updateTensionMeter(dt, tether, trav);

    this.tensionPayload.tension = tether.tension;
    this.context.broker.publish(GameEvent.TETHER_TENSION_CHANGE, this.tensionPayload);

    this.lengthPayload.length = tether.currentLength;
    this.lengthPayload.maxLength = tether.maxLength;
    this.context.broker.publish(GameEvent.TETHER_LENGTH_CHANGE, this.lengthPayload);

    if (trav.state !== this.lastTraversalState) {
      this.lastTraversalState = trav.state;
      this.context.broker.publish(GameEvent.PLAYER_STATE_CHANGE, {
        state: trav.state,
        launchPower: trav.launchPower
      });
    }
  }

  private updateTensionMeter(
    dt: number,
    tether: TetherComponent,
    trav: TraversalStateComponent
  ): void {
    const reelConfig = GAMEPLAY_TUNING.REEL;

    if (trav.state === "WALL_SLIDING") {
      if (trav.stickyEntityId === undefined || trav.stickyEntityId === -1) {
        const tensionDelta = reelConfig.WALL_SLIDE_PASSIVE_TENSION_RATE;
        tether.tension += tensionDelta * dt;

        const TENSION_STRETCH_RANGE = 2.0;
        const stretch = Math.max(0, tether.currentLength - tether.maxLength);
        const stretchRatio = stretch / TENSION_STRETCH_RANGE;
        tether.tension += stretchRatio * dt;
      }
    } else {
      tether.tension -= GAMEPLAY_TUNING.PLAYER.TENSION_DECAY_RATE * dt;
    }

    tether.tension = Math.max(
      0.0,
      Math.min(CANONICAL_UNITS.TETHER_STRAIN.SNAP_LIMIT, tether.tension)
    );
  }
}
