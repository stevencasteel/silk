import { SystemContext } from "../../core/engine/SystemContext";

export type WeaverStateType = "PATROLLING" | "STRIKING" | "ASCENDING" | "DEFEATED" | "SHOCKWAVE";

export interface IWeaverState {
  readonly type: WeaverStateType;
  readonly name: string;
  readonly audioParams?: { baseFreq: number; lfoHz: number; harmonicity: number };
  readonly hue: string;
  enter(ctx: SystemContext): void;
  exit(ctx: SystemContext): void;
  update(ctx: SystemContext, dt: number): WeaverStateType | null;
}
