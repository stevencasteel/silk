import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { InputIntentComponent, PlayerStatsComponent, TetherComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { CommandBus } from "../../core/commands/CommandBus";
import { SetKinematicVelocityCommand } from "../../physics/commands/PhysicsCommands";

export class PlayerMovementSystem implements ISystem {
  readonly phase = SystemPhase.Intents;

  constructor(
    private refs: EntityRefs,
    private inputs: ComponentStore<InputIntentComponent>,
    private stats: ComponentStore<PlayerStatsComponent>,
    private tethers: ComponentStore<TetherComponent>,
    _traversal: any,
    _transforms: any,
    private commands: CommandBus,
    _broker: any
  ) {
    void _traversal;
    void _transforms;
    void _broker;
  }

  public update(dt: number): void {
    void dt;
    const input = this.inputs.get(this.refs.player);
    const stats = this.stats.get(this.refs.player);
    const tether = this.tethers.get(this.refs.player);
    
    if (!input || !stats || !tether) return;

    // Direct left and right steering controls to drive pendular momentum
    if (tether.isAttached) {
      this.commands.dispatch<SetKinematicVelocityCommand>({ 
        type: "SET_KINEMATIC_VELOCITY", 
        entityId: this.refs.player, 
        x: input.x * stats.swingForce, 
        y: 0, 
        z: 0 
      });
    }
  }
}
