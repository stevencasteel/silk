import { ComponentStore } from "../../core/ecs/ComponentStore";
import { WardenAIComponent, TransformComponent, WardenTraversalComponent, HealthComponent } from "../../core/ecs/Components";
import { EventBroker } from "../../core/events/EventBroker";
import { CommandBus } from "../../core/commands/CommandBus";
import { EntityId } from "../../core/ecs/Entity";

export type WardenStateType = "SWEEPING" | "DORMANT" | "HUNTING" | "CHARGE_PREP" | "CHARGE_ATTACK" | "RECOVERY" | "FAKE_DEATH" | "FINAL_PHASE";

export interface AIContext {
  wardenId: EntityId;
  playerId: EntityId;
  ai: WardenAIComponent;
  transforms: ComponentStore<TransformComponent>;
  wardenTraversal: ComponentStore<WardenTraversalComponent>;
  healths: ComponentStore<HealthComponent>;
  commands: CommandBus;
  broker: EventBroker;
}

export interface IWardenState {
  readonly type: WardenStateType;
  readonly name: string;
  readonly hue: string;
  enter(ctx: AIContext): void;
  exit(ctx: AIContext): void;
  update(ctx: AIContext, dt: number): WardenStateType | null;
}
