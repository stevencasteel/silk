import { SystemContext } from "../../core/engine/SystemContext";
import { TraversalState } from "../../core/ecs/Components";

export interface IPlayerState {
  readonly type: TraversalState;
  enter(ctx: SystemContext): void;
  exit(ctx: SystemContext): void;
  update(ctx: SystemContext, dt: number): TraversalState | null;
}
