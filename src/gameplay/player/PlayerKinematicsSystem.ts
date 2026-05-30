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
  StickySurfaceComponent
} from "../../core/ecs/Components";
import { ApplyImpulseCommand } from "../../physics/commands/PhysicsCommands";
import { IPlayerState } from "./IPlayerState";
import { PlayerStateUtils } from "./states/PlayerStateUtils";
import { ARENA_CONFIG, GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";
import { ParallaxScrollSystem } from "../../visual/systems/ParallaxScrollSystem";

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

    const input = this.context.stores
      .get<InputIntentComponent>("input")
      .get(this.context.refs.player);
    if (input) {
      PlayerStateUtils.updateWebStruggle(this.context, target, input, trav);
    }

    if (trav.safeLaunchTimer !== undefined && trav.safeLaunchTimer > 0) {
      trav.safeLaunchTimer = Math.max(0, trav.safeLaunchTimer - dt);
    }

    if (trav.recoilTimer !== undefined && trav.recoilTimer > 0) {
      trav.recoilTimer = Math.max(0, trav.recoilTimer - dt);

      const knockbackFriction = 35.0;
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      if (speed > 0.01) {
        const decel = knockbackFriction * dt;
        const newSpeed = Math.max(0, speed - decel);
        const scale = newSpeed / speed;
        vel.x *= scale;
        vel.y *= scale;
      }
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
    if (trav.state === "WALL_STICKING") {
      const reelConfig = GAMEPLAY_TUNING.REEL;
      let chargeRate = reelConfig.WALL_SLIDE_PASSIVE_TENSION_RATE;

      if (trav.stickyEntityId !== undefined && trav.stickyEntityId !== -1) {
        const stickyStore = this.context.stores.get<StickySurfaceComponent>("stickySurface");
        const sticky = stickyStore ? stickyStore.get(trav.stickyEntityId) : undefined;
        if (sticky && sticky.isActive) {
          const currentScrollSpeed = ParallaxScrollSystem.currentScrollSpeed;
          const speedScale = 1.0 + (sticky.speed / Math.max(1.0, currentScrollSpeed)) * 0.5;
          chargeRate *= speedScale;
        }
      }

      tether.tension = Math.min(1.0, tether.tension + chargeRate * dt);
    } else {
      tether.tension = Math.max(
        0.0,
        tether.tension - GAMEPLAY_TUNING.PLAYER.TENSION_DECAY_RATE * dt
      );
    }
  }
}
