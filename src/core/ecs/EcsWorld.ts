import { EntityId, EntityRegistry } from "./Entity";
import { IComponentStore } from "./ComponentStore";

export class EcsWorld {
  private entities = new EntityRegistry();
  private stores = new Set<IComponentStore>();

  public create(): EntityId {
    return this.entities.create();
  }

  public destroy(id: EntityId): void {
    this.entities.destroy(id);
    for (const store of this.stores) {
      store.remove(id);
    }
  }

  public clearEntityComponents(id: EntityId): void {
    for (const store of this.stores) {
      store.remove(id);
    }
  }

  public registerStore(store: IComponentStore): void {
    this.stores.add(store);
  }

  public unregisterStore(store: IComponentStore): void {
    this.stores.delete(store);
  }

  public count(): number {
    return this.entities.count();
  }

  public isAlive(id: EntityId): boolean {
    return this.entities.isAlive(id);
  }

  public clear(): void {
    this.entities.clear();
    for (const store of this.stores) {
      store.clear();
    }
  }
}
