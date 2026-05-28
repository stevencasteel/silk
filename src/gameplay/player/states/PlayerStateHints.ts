import { TraversalState } from "../../../core/ecs/Components";

export class PlayerStateHints {
  public static getHintForState(
    state: TraversalState,
    tension: number
  ): { text: string; color: string; opacity: number } {
    if (state !== "WALL_SLIDING") {
      return { text: "", color: "rgb(161, 161, 170)", opacity: 0 };
    }
    if (tension >= 1.0) {
      return { text: "MAX TENSION — LET GO NOW", color: "rgb(239, 68, 68)", opacity: 1 };
    }
    if (tension >= 0.85) {
      return { text: "RELEASE CLING TO LAUNCH", color: "rgb(245, 158, 11)", opacity: 1 };
    }
    if (tension > 0.02) {
      return { text: "HOLD — CHARGING TETHER", color: "rgb(161, 161, 170)", opacity: 1 };
    }
    return { text: "", color: "rgb(161, 161, 170)", opacity: 0 };
  }
}
