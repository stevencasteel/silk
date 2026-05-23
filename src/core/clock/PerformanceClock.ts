import { IClock } from "./IClock";

export class PerformanceClock implements IClock {
  public now(): number {
    return performance.now();
  }
}
