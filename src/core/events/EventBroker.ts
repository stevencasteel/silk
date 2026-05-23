import { GameEvent, GameEventMap } from "./GameEvents";

export type EventCallback<T> = (payload: T) => void;

export class EventBroker {
  private listeners: { [K in GameEvent]?: Set<EventCallback<any>> } = {};

  public subscribe<K extends GameEvent>(event: K, cb: EventCallback<GameEventMap[K]>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event]!.add(cb);
    return () => {
      this.listeners[event]?.delete(cb);
    };
  }

  public publish<K extends GameEvent>(event: K, payload: GameEventMap[K]): void {
    const set = this.listeners[event];
    if (set) {
      set.forEach((cb) => cb(payload));
    }
  }

  public clear(): void {
    this.listeners = {};
  }
}
