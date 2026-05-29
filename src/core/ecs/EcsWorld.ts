import { EntityId, EntityRegistry } from "./Entity";
import { IEcsWorld, IComponentStoreBase } from "../../contracts/ICore";

export class EcsWorld implements IEcsWorld {
  private entities = new EntityRegistry();
  private stores = new Set<IComponentStoreBase>();

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

  public registerStore(store: IComponentStoreBase): void {
    this.stores.add(store);
  }

  public unregisterStore(store: IComponentStoreBase): void {
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
