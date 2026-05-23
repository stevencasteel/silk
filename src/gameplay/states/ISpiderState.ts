import { ComponentStore } from "../../core/ecs/ComponentStore";
import { SpiderAIComponent, TransformComponent, SpiderTraversalComponent, HealthComponent } from "../../core/ecs/Components";
import { EventBroker } from "../../core/events/EventBroker";
import { CommandBus } from "../../core/commands/CommandBus";
import { EntityId } from "../../core/ecs/Entity";

export type SpiderStateType = "SWEEPING" | "DASHING" | "RETURNING" | "DEFEATED";

export interface AIContext {
  spiderId: EntityId;
  playerId: EntityId;
  ai: SpiderAIComponent;
  transforms: ComponentStore<TransformComponent>;
  spiderTraversal: ComponentStore<SpiderTraversalComponent>;
  healths: ComponentStore<HealthComponent>;
  commands: CommandBus;
  broker: EventBroker;
}

export interface ISpiderState {
  readonly type: SpiderStateType;
  readonly name: string;
  readonly hue: string;
  enter(ctx: AIContext): void;
  exit(ctx: AIContext): void;
  update(ctx: AIContext, dt: number): SpiderStateType | null;
}
