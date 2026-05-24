import { ICommand } from "../../core/commands/CommandBus";
import { EntityId } from "../../core/ecs/Entity";

export interface SetKinematicVelocityCommand extends ICommand {
  readonly type: "SET_KINEMATIC_VELOCITY";
  entityId: EntityId;
  x: number;
  y: number;
  z: number;
}
export interface ApplyImpulseCommand extends ICommand {
  readonly type: "APPLY_IMPULSE";
  entityId: EntityId;
  x: number;
  y: number;
  z: number;
}
