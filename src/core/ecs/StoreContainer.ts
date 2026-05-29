import { IStoreContainer, IComponentStore } from "../../contracts/ICore";

export class StoreContainer implements IStoreContainer {
  private stores = new Map<string, unknown>();

  public register<T>(key: string, store: IComponentStore<T>): void {
    this.stores.set(key, store);
  }

  public get<T>(key: string): IComponentStore<T> {
    const store = this.stores.get(key);
    if (!store) {
      throw new Error(`Store Container: ComponentStore for key "${key}" is not registered.`);
    }
    return store as IComponentStore<T>;
  }
}
