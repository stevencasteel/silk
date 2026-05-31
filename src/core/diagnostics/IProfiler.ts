export interface IProfiler {
  readonly isEnabled: boolean;
  beginFrame(): void;
  endFrame(): void;
  recordSystem(name: string, duration: number): void;
  getFps(): number;
  getFrameTime(): number;
  getSystemTimings(): Map<string, number>;
  clearFrame(): void;
}
