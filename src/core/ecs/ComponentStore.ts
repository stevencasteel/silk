import { EntityId } from "./Entity";
import { IComponentStore } from "../../contracts/ICore";

export class ComponentStore<T> implements IComponentStore<T> {
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

  public forEach(callback: (id: EntityId, component: T) => void): void {
    this.data.forEach((value, key) => {
      callback(key, value);
    });
  }

  public clear(): void {
    this.data.clear();
  }
}
