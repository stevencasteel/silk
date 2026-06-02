import { EntityId } from "../core/ecs/Entity";
import { GameEvent, GameEventMap } from "../core/events/GameEvents";

export interface ICommand {
  readonly type: string;
}

export type CommandHandler<T extends ICommand> = (cmd: T) => void;

export interface ICommandBus {
  register<T extends ICommand>(type: T["type"], handler: CommandHandler<T>): void;
  dispatch<T extends ICommand>(cmd: T): void;
  flush(): void;
  clear(): void;
}

export type EventCallback<T> = (payload: T) => void;

export interface IEventBroker {
  subscribe<K extends GameEvent>(event: K, cb: EventCallback<GameEventMap[K]>): () => void;
  publish<K extends GameEvent>(event: K, payload: GameEventMap[K]): void;
  clear(): void;
}

export interface IComponentStoreBase {
  remove(id: EntityId): void;
  clear(): void;
}

export interface IComponentStore<T> extends IComponentStoreBase {
  add(id: EntityId, component: T): void;
  get(id: EntityId): T | undefined;
  has(id: EntityId): boolean;
  entries(): IterableIterator<[EntityId, T]>;
  forEach(callback: (id: EntityId, component: T) => void): void;
}

export interface IStoreContainer {
  register<T>(key: string, store: IComponentStore<T>): void;
  get<T>(key: string): IComponentStore<T>;
}

export interface IEcsWorld {
  create(): EntityId;
  destroy(id: EntityId): void;
  clearEntityComponents(id: EntityId): void;
  registerStore(store: IComponentStoreBase): void;
  unregisterStore(store: IComponentStoreBase): void;
  count(): number;
  isAlive(id: EntityId): boolean;
  clear(): void;
}

export interface IEntityRefs {
  player: EntityId;
  weaver: EntityId;
}
