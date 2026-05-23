import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { InputIntentComponent, PlayerStatsComponent, TetherComponent, TraversalStateComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { CommandBus } from "../../core/commands/CommandBus";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { SetKinematicVelocityCommand, SetRopeAttachedCommand, SetRopeMaxLengthCommand, ApplyImpulseCommand } from "../../physics/commands/PhysicsCommands";

export class PlayerMovementSystem implements ISystem {
  readonly phase = SystemPhase.Intents;
  private spaceWasPressed = false;
  private detachWasPressed = false;

  constructor(
    private refs: EntityRefs,
    private inputs: ComponentStore<InputIntentComponent>,
    private stats: ComponentStore<PlayerStatsComponent>,
    private tethers: ComponentStore<TetherComponent>,
    private traversal: ComponentStore<TraversalStateComponent>,
    private commands: CommandBus,
    private broker: EventBroker
  ) {}

  public update(dt: number): void {
    const input = this.inputs.get(this.refs.player);
    const stats = this.stats.get(this.refs.player);
    const tether = this.tethers.get(this.refs.player);
    const trav = this.traversal.get(this.refs.player);
    if (!input || !stats || !tether || !trav) return;

    if (input.detach && !this.detachWasPressed) {
      tether.isAttached = !tether.isAttached;
      this.commands.dispatch<SetRopeAttachedCommand>({ type: "SET_ROPE_ATTACHED", attached: tether.isAttached });
    }
    this.detachWasPressed = input.detach;

    if (input.jump && !this.spaceWasPressed) {
      if (trav.state === "WALL_SLIDING") {
        const launchX = trav.wallNormalX * 18.0;
        const launchY = 14.0;
        this.commands.dispatch<ApplyImpulseCommand>({
          type: "APPLY_IMPULSE",
          entityId: this.refs.player,
          x: launchX,
          y: launchY,
          z: 0
        });
        this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.3, duration: 0.2 });
      }
    }
    this.spaceWasPressed = input.jump;

    if (tether.isAttached) {
      if (input.y > 0) tether.maxLength = Math.max(stats.minRope, tether.maxLength - stats.climbSpeed * dt);
      else if (input.y < 0) tether.maxLength = Math.min(stats.maxRope, tether.maxLength + stats.climbSpeed * dt);
      
      this.commands.dispatch<SetRopeMaxLengthCommand>({ type: "SET_ROPE_MAX_LENGTH", length: tether.maxLength });
      this.commands.dispatch<SetKinematicVelocityCommand>({ type: "SET_KINEMATIC_VELOCITY", entityId: this.refs.player, x: input.x * stats.swingForce, y: 0, z: 0 });
    } else {
      this.commands.dispatch<SetKinematicVelocityCommand>({ type: "SET_KINEMATIC_VELOCITY", entityId: this.refs.player, x: input.x * stats.moveSpeed, y: 0, z: 0 });
    }

    const speed = Math.sqrt(tether.dynamicVelX * tether.dynamicVelX + tether.dynamicVelY * tether.dynamicVelY);
    this.broker.publish(GameEvent.PLAYER_VELOCITY_CHANGED, {
      velocity: speed,
      maxVelocity: 30.0
    });
  }
}
