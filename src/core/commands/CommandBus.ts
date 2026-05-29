import { ICommandBus, ICommand, CommandHandler } from "../../contracts/ICore";
export type { ICommand, CommandHandler };

export class CommandBus implements ICommandBus {
  private handlers = new Map<string, CommandHandler<ICommand>[]>();
  private queueA: ICommand[] = [];
  private queueB: ICommand[] = [];
  private activeQueue: ICommand[] = this.queueA;

  public register<T extends ICommand>(type: T["type"], handler: CommandHandler<T>): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler as CommandHandler<ICommand>);
  }

  public dispatch<T extends ICommand>(cmd: T): void {
    this.activeQueue.push(cmd);
  }

  public flush(): void {
    const pending = this.activeQueue;
    if (pending.length === 0) return;

    this.activeQueue = pending === this.queueA ? this.queueB : this.queueA;

    for (let i = 0; i < pending.length; i++) {
      const cmd = pending[i];
      const handlers = this.handlers.get(cmd.type);
      if (handlers) {
        for (let j = 0; j < handlers.length; j++) {
          handlers[j](cmd);
        }
      }
    }

    pending.length = 0;
  }

  public clear(): void {
    this.handlers.clear();
    this.queueA.length = 0;
    this.queueB.length = 0;
    this.activeQueue = this.queueA;
  }
}
