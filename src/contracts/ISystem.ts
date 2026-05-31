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

export function isInitializable(system: unknown): system is IInitializable {
  return hasMethod(system, "init");
}

export function isUpdateable(system: unknown): system is IUpdateable {
  return hasMethod(system, "update");
}

export function isRenderable(system: unknown): system is IRenderable {
  return hasMethod(system, "render");
}

export function isDisposable(system: unknown): system is IDisposable {
  return hasMethod(system, "dispose");
}
