import { ComponentStore } from "../../core/ecs/ComponentStore";
import { WeaverAIComponent, TransformComponent, WeaverTraversalComponent, HealthComponent } from "../../core/ecs/Components";
import { EventBroker } from "../../core/events/EventBroker";
import { CommandBus } from "../../core/commands/CommandBus";
import { EntityId } from "../../core/ecs/Entity";

export type WeaverStateType = "SWEEPING" | "DASHING" | "RETURNING" | "DEFEATED";

export interface AIContext {
  weaverId: EntityId;
  playerId: EntityId;
  ai: WeaverAIComponent;
  transforms: ComponentStore<TransformComponent>;
  weaverTraversal: ComponentStore<WeaverTraversalComponent>;
  healths: ComponentStore<HealthComponent>;
  commands: CommandBus;
  broker: EventBroker;
}

export interface IWeaverState {
  readonly type: WeaverStateType;
  readonly name: string;
  readonly hue: string;
  enter(ctx: AIContext): void;
  exit(ctx: AIContext): void;
  update(ctx: AIContext, dt: number): WeaverStateType | null;
}
