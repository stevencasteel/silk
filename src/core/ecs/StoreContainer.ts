import { ComponentStore } from "./ComponentStore";

export class StoreContainer {
  private stores = new Map<string, unknown>();

  public register<T>(key: string, store: ComponentStore<T>): void {
    this.stores.set(key, store);
  }

  public get<T>(key: string): ComponentStore<T> {
    const store = this.stores.get(key);
    if (!store) {
      throw new Error(`Store Container: ComponentStore for key "${key}" is not registered.`);
    }
    return store as ComponentStore<T>;
  }
}
