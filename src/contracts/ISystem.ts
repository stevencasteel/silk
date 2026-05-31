import { SystemPhase, InitPhase } from "./SystemPhase";

export interface ISystem {
  readonly phase: SystemPhase;
  readonly initPhase?: InitPhase;
}

export interface IInitializable {
  init(): Promise<void> | void;
}

export interface IUpdateable {
  update(dt: number): void;
}

export interface IRenderable {
  render(alpha: number): void;
}

export interface IDisposable {
  dispose(): void;
}

function hasMethod(system: unknown, methodName: string): boolean {
  if (system === null || typeof system !== "object") return false;
  const candidate = system as Record<string, unknown>;
  return typeof candidate[methodName] === "function";
}

function createTypeGuard<T>(methodName: string): (system: unknown) => system is T {
  return (system: unknown): system is T => hasMethod(system, methodName);
}

export const isInitializable = createTypeGuard<IInitializable>("init");
export const isUpdateable = createTypeGuard<IUpdateable>("update");
export const isRenderable = createTypeGuard<IRenderable>("render");
export const isDisposable = createTypeGuard<IDisposable>("dispose");
