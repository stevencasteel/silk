import { GameEvent, GameEventMap } from "./GameEvents";

export type EventCallback<T> = (payload: T) => void;

export class EventBroker {
    private listeners: { [K in GameEvent]?: Set<EventCallback<unknown>> } = {};
    public traffic: Map<string, number> = new Map();

    public subscribe<K extends GameEvent>(event: K, cb: EventCallback<GameEventMap[K]>): () => void {
        if (!this.listeners[event]) {
            this.listeners[event] = new Set<EventCallback<unknown>>();
        }
        this.listeners[event]!.add(cb as EventCallback<unknown>);
        return () => {
            this.listeners[event]?.delete(cb as EventCallback<unknown>);
        };
    }

    public publish<K extends GameEvent>(event: K, payload: GameEventMap[K]): void {
        this.traffic.set(event, (this.traffic.get(event) || 0) + 1);
        const set = this.listeners[event];
        if (set) {
            set.forEach((cb) => {
                (cb as EventCallback<GameEventMap[K]>)(payload);
            });
        }
    }

    public clearTraffic(): void {
        this.traffic.clear();
    }

    public clear(): void {
        this.listeners = {};
        this.traffic.clear();
    }
}
