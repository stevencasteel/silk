export interface ICommand {
    readonly type: string;
}

export type CommandHandler<T extends ICommand> = (cmd: T) => void;

export class CommandBus {
    private handlers = new Map<string, CommandHandler<ICommand>[]>();
    private queue: ICommand[] = [];

    public register<T extends ICommand>(type: string, handler: CommandHandler<T>): void {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, []);
        }
        this.handlers.get(type)!.push(handler as CommandHandler<ICommand>);
    }

    public dispatch<T extends ICommand>(cmd: T): void {
        this.queue.push(cmd);
    }

    public flush(): void {
        const currentQueue = this.queue;
        this.queue = [];
        for (let i = 0; i < currentQueue.length; i++) {
            const cmd = currentQueue[i];
            const handlers = this.handlers.get(cmd.type);
            if (handlers) {
                for (let j = 0; j < handlers.length; j++) {
                    handlers[j](cmd);
                }
            }
        }
    }
    
    public clear(): void {
        this.handlers.clear();
        this.queue = [];
    }
}
