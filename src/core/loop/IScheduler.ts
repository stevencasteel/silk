export type SchedulerCallback = (time: number) => void;

export interface IScheduler {
  start(callback: SchedulerCallback): void;
  stop(): void;
}
