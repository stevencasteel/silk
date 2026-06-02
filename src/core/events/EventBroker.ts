import { GameEvent, GameEventMap } from "./GameEvents";
import { IEventBroker, EventCallback } from "../../contracts/ICore";

export class EventBroker implements IEventBroker {
  private listeners: { [K in GameEvent]?: Set<EventCallback<unknown>> } = {};

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
    const set = this.listeners[event];
    if (set) {
      set.forEach((cb) => {
        (cb as EventCallback<GameEventMap[K]>)(payload);
      });
    }
  }

  public getTraffic(): Map<string, number> {
    return new Map<string, number>();
  }

  public clearTraffic(): void {}

  public clear(): void {
    this.listeners = {};
  }
}
