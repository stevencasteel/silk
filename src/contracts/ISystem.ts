import { SystemPhase, InitPhase } from "./SystemPhase";

export interface ISystem {
  readonly phase: SystemPhase;
  readonly initPhase?: InitPhase;
  init?(): Promise<void> | void;
  update?(dt: number): void;
  render?(alpha: number): void;
  dispose?(): void;
}
