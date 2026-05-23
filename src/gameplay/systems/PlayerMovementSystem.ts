import { ISystem } from "../../contracts/ISystem";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { InputIntentComponent, PlayerStatsComponent, TetherComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { CommandBus } from "../../core/commands/CommandBus";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { SetKinematicVelocityCommand, SetRopeAttachedCommand, SetRopeMaxLengthCommand } from "../../physics/commands/PhysicsCommands";

export class PlayerMovementSystem implements ISystem {
    private spaceWasPressed = false;
    constructor(
        private refs: EntityRefs,
        private inputs: ComponentStore<InputIntentComponent>,
        private stats: ComponentStore<PlayerStatsComponent>,
        private tethers: ComponentStore<TetherComponent>,
        private commands: CommandBus,
        private broker: EventBroker
    ) {}

    public update(dt: number): void {
        const input = this.inputs.get(this.refs.player);
        const stats = this.stats.get(this.refs.player);
        const tether = this.tethers.get(this.refs.player);
        if (!input || !stats || !tether) return;

        if (input.jump && !this.spaceWasPressed) {
            tether.isAttached = !tether.isAttached;
            this.commands.dispatch<SetRopeAttachedCommand>({ type: "SET_ROPE_ATTACHED", attached: tether.isAttached });
        }
        this.spaceWasPressed = input.jump;

        if (tether.isAttached) {
            if (input.y > 0) tether.maxLength = Math.max(stats.minRope, tether.maxLength - stats.climbSpeed * dt);
            else if (input.y < 0) tether.maxLength = Math.min(stats.maxRope, tether.maxLength + stats.climbSpeed * dt);
            this.commands.dispatch<SetRopeMaxLengthCommand>({ type: "SET_ROPE_MAX_LENGTH", length: tether.maxLength });
            this.commands.dispatch<SetKinematicVelocityCommand>({ type: "SET_KINEMATIC_VELOCITY", entityId: this.refs.player, x: input.x * stats.swingForce, y: 0, z: 0 });
        } else {
            this.commands.dispatch<SetKinematicVelocityCommand>({ type: "SET_KINEMATIC_VELOCITY", entityId: this.refs.player, x: input.x * stats.moveSpeed, y: input.y * stats.moveSpeed, z: 0 });
        }

        this.broker.publish(GameEvent.PLAYER_VELOCITY_CHANGED, {
            velocity: tether.isAttached ? 8.0 : Math.sqrt(input.x * input.x + input.y * input.y) * stats.moveSpeed,
            maxVelocity: stats.moveSpeed
        });
    }
}
