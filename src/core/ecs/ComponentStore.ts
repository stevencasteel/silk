import { EntityId } from "./Entity";

export class ComponentStore<T> {
  private data: Map<EntityId, T> = new Map();

  public add(id: EntityId, component: T): void {
    this.data.set(id, component);
  }

  public get(id: EntityId): T | undefined {
    return this.data.get(id);
  }

  public has(id: EntityId): boolean {
    return this.data.has(id);
  }

  public remove(id: EntityId): void {
    this.data.delete(id);
  }

  public entries(): IterableIterator<[EntityId, T]> {
    return this.data.entries();
  }

  public clear(): void {
    this.data.clear();
  }
}
