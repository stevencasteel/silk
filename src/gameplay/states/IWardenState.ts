import { ComponentStore } from "../../core/ecs/ComponentStore";
import { WardenAIComponent, TransformComponent } from "../../core/ecs/Components";
import { EventBroker } from "../../core/events/EventBroker";
import { CommandBus } from "../../core/commands/CommandBus";
import { EntityId } from "../../core/ecs/Entity";

export type WardenStateType = "DORMANT" | "HUNTING" | "CHARGE_PREP" | "CHARGE_ATTACK" | "RECOVERY";

export interface AIContext {
    wardenId: EntityId;
    playerId: EntityId;
    ai: WardenAIComponent;
    transforms: ComponentStore<TransformComponent>;
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
