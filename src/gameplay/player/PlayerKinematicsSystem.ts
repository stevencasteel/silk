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
  InputIntentComponent
} from "../../core/ecs/Components";
import { ApplyImpulseCommand } from "../../physics/commands/PhysicsCommands";
import { IPlayerState } from "./IPlayerState";
import { PlayerStateUtils } from "./states/PlayerStateUtils";
import { GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";

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

    const radius = wTrans.scaleX ? wTrans.scaleX * 4.4 : 4.4;
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
    } else if (trav.state === "WALL_STICKING") {
      const dx = target.x - tether.anchorX;
      const maxDy = Math.sqrt(Math.max(0.1, tether.maxLength * tether.maxLength - dx * dx));
      if (target.y < tether.anchorY - maxDy) {
        target.y = tether.anchorY - maxDy;
        if (vel.y < 0) {
          vel.y = 0;
        }
        if (trav.stickyEntityId !== undefined && trav.stickyEntityId !== -1) {
          const transforms = this.context.stores.get<TransformComponent>("transform");
          const bugTrans = transforms.get(trav.stickyEntityId);
          if (bugTrans) {
            trav.stickyWallYOffset = target.y - bugTrans.y;
          }
        }
      }
    }

    tether.currentLength = getDistance2D(target.x, target.y, tether.anchorX, tether.anchorY);

    this.updateTensionMeter(dt, tether, trav);

    this.tensionPayload.tension = tether.tension;
    this.context.broker.publish(GameEvent.TETHER_TENSION_CHANGE, this.tensionPayload);

    this.lengthPayload.length = tether.currentLength;
    this.lengthPayload.maxLength = tether.maxLength;
    this.context.broker.publish(GameEvent.TETHER_LENGTH_CHANGE, this.lengthPayload);

    // Dispatch unified, highly granular telemetry payload directly to window renders
    const renderEvt = new CustomEvent("silk-tension-render-tick", {
      detail: {
        tension: tether.tension,
        length: tether.currentLength,
        maxLength: tether.maxLength
      }
    });
    window.dispatchEvent(renderEvt);

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
    const tautnessThreshold = 0.85;
    const currentTautness = tether.currentLength / Math.max(1.0, tether.maxLength);
    const isWallSticking = trav.state === "WALL_STICKING";

    if (currentTautness >= tautnessThreshold && isWallSticking) {
      const stretchAmount = (currentTautness - tautnessThreshold) / (1.0 - tautnessThreshold);
      const absoluteMin = GAMEPLAY_TUNING.REEL.MIN_LENGTH;
      const absoluteMax = GAMEPLAY_TUNING.REEL.MAX_LENGTH;

      const reelProgress = (tether.maxLength - absoluteMin) / (absoluteMax - absoluteMin);
      const maxAchievableTension = Math.max(0.15, Math.min(1.3, reelProgress * 1.3));

      tether.tension = Math.max(0.0, Math.min(maxAchievableTension, stretchAmount * maxAchievableTension));
    } else {
      const decayRate = GAMEPLAY_TUNING.PLAYER.TENSION_DECAY_RATE ? GAMEPLAY_TUNING.PLAYER.TENSION_DECAY_RATE * 2.0 : 8.0;
      tether.tension = Math.max(0.0, tether.tension - decayRate * dt);
    }
  }
}
