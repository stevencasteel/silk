export interface ICommand {
    readonly type: string;
}

export type CommandHandler<T extends ICommand> = (cmd: T) => void;

export class CommandBus {
    private handlers = new Map<string, CommandHandler<any>[]>();

    public register<T extends ICommand>(type: string, handler: CommandHandler<T>): void {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, []);
        }
        this.handlers.get(type)!.push(handler);
    }

    public dispatch<T extends ICommand>(cmd: T): void {
        const handlers = this.handlers.get(cmd.type);
        if (handlers) {
            for (const handler of handlers) {
                handler(cmd);
            }
        }
    }
    
    public clear(): void {
        this.handlers.clear();
    }
}
