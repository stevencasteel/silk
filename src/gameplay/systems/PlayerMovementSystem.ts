import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { InputIntentComponent, PlayerStatsComponent, TetherComponent, TraversalStateComponent, TransformComponent } from "../../core/ecs/Components";
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
    private transforms: ComponentStore<TransformComponent>,
    private commands: CommandBus,
    private broker: EventBroker
  ) {}

  public update(dt: number): void {
    const input = this.inputs.get(this.refs.player);
    const stats = this.stats.get(this.refs.player);
    const tether = this.tethers.get(this.refs.player);
    const trav = this.traversal.get(this.refs.player);
    const playerTrans = this.transforms.get(this.refs.player);
    if (!input || !stats || !tether || !trav || !playerTrans) return;

    if (input.detach && !this.detachWasPressed) {
      if (!tether.isAttached) {
        let anchorY = 28.0; 
        const playerX = playerTrans.x;
        const playerY = playerTrans.y;

        if (playerX >= -15.0 && playerX <= -7.0 && playerY < 11.5) {
          anchorY = 11.5;
        } else if (playerX >= 7.0 && playerX <= 15.0 && playerY < 17.5) {
          anchorY = 17.5;
        }

        const anchorTrans = this.transforms.get(this.refs.anchor);
        if (anchorTrans) {
          anchorTrans.x = playerX;
          anchorTrans.y = anchorY;
          anchorTrans.z = 0;
        }

        tether.anchorX = playerX;
        tether.anchorY = anchorY;
        tether.anchorZ = 0;
        
        const dx = playerTrans.x - playerX;
        const dy = playerTrans.y - anchorY;
        tether.maxLength = Math.max(stats.minRope, Math.sqrt(dx * dx + dy * dy));
        tether.isAttached = true;

        this.commands.dispatch<SetRopeAttachedCommand>({ type: "SET_ROPE_ATTACHED", attached: true });
        this.commands.dispatch<SetRopeMaxLengthCommand>({ type: "SET_ROPE_MAX_LENGTH", length: tether.maxLength });
        this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.15, duration: 0.15 });
      } else {
        tether.isAttached = false;
        this.commands.dispatch<SetRopeAttachedCommand>({ type: "SET_ROPE_ATTACHED", attached: false });
      }
    }
    this.detachWasPressed = input.detach;

    if (input.jump && !this.spaceWasPressed) {
      if (trav.state === "WALL_SLIDING") {
        const chargeMultiplier = 1.0 + trav.charge * 1.5;
        const launchX = trav.wallNormalX * 15.0 * chargeMultiplier;
        const launchY = 11.0 * chargeMultiplier;
        
        trav.charge = 0.0;

        this.commands.dispatch<ApplyImpulseCommand>({
          type: "APPLY_IMPULSE",
          entityId: this.refs.player,
          x: launchX,
          y: launchY,
          z: 0
        });

        const shakeAmplitude = 0.2 + (chargeMultiplier - 1.0) * 0.4;
        this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: shakeAmplitude, duration: 0.25 });
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
