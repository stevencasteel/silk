export interface IEntityPool<T, Args extends unknown[] = []> {
  acquire(...args: Args): T;
  release(id: number): void;
  reset(): void;
  dispose(): void;
}
