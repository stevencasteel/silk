import { ICommand } from "../../core/commands/CommandBus";
import { EntityId } from "../../core/ecs/Entity";

export interface DamageRequestCommand extends ICommand {
  readonly type: "DAMAGE_REQUEST";
  readonly targetId: EntityId;
  readonly amount: number;
  readonly source: string;
  readonly knockbackX?: number;
  readonly knockbackY?: number;
}
