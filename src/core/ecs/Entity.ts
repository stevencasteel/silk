export type EntityId = number;

export class EntityRegistry {
  private nextId: EntityId = 1;
  private alive: Set<EntityId> = new Set();

  public create(): EntityId {
    const id = this.nextId++;
    this.alive.add(id);
    return id;
  }

  public destroy(id: EntityId): void {
    this.alive.delete(id);
  }

  public isAlive(id: EntityId): boolean {
    return this.alive.has(id);
  }
  
  public count(): number {
    return this.alive.size;
  }
  
  public clear(): void {
    this.alive.clear();
  }
}
