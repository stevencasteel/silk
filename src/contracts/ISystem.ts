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

export function isInitializable(system: unknown): system is IInitializable {
  if (system === null || typeof system !== "object") return false;
  const candidate = system as Record<string, unknown>;
  return typeof candidate.init === "function";
}

export function isUpdateable(system: unknown): system is IUpdateable {
  if (system === null || typeof system !== "object") return false;
  const candidate = system as Record<string, unknown>;
  return typeof candidate.update === "function";
}

export function isRenderable(system: unknown): system is IRenderable {
  if (system === null || typeof system !== "object") return false;
  const candidate = system as Record<string, unknown>;
  return typeof candidate.render === "function";
}

export function isDisposable(system: unknown): system is IDisposable {
  if (system === null || typeof system !== "object") return false;
  const candidate = system as Record<string, unknown>;
  return typeof candidate.dispose === "function";
}
