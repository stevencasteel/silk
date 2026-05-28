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
  KinematicVelocityComponent
} from "../../core/ecs/Components";
import { ApplyImpulseCommand } from "../../physics/commands/PhysicsCommands";
import { IPlayerState } from "./IPlayerState";
import { PlayerAirborneState } from "./states/PlayerAirborneState";
import { PlayerWallSlidingState } from "./states/PlayerWallSlidingState";
import { PlayerLaunchingState } from "./states/PlayerLaunchingState";
import { PlayerStateUtils } from "./states/PlayerStateUtils";
import { ARENA_CONFIG, CANONICAL_UNITS, GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";

export class PlayerKinematicsSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;

  private states = new Map<string, IPlayerState>();
  private lastTraversalState: string = "";
  private tensionPayload = { tension: 0.0 };
  private lengthPayload = { length: 0.0, maxLength: 0.0 };

  constructor(private context: SystemContext) {
    this.states.set("AIRBORNE", new PlayerAirborneState());
    this.states.set("WALL_SLIDING", new PlayerWallSlidingState());
    this.states.set("LAUNCHING", new PlayerLaunchingState());
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
