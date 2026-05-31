import { GameEvent, GameEventMap } from "./GameEvents";
import { IEventBroker, EventCallback } from "../../contracts/ICore";
import { EventTrafficTracker } from "./EventTrafficTracker";

export class EventBroker implements IEventBroker {
  private listeners: { [K in GameEvent]?: Set<EventCallback<unknown>> } = {};
  private trafficTracker: EventTrafficTracker = new EventTrafficTracker();

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
    this.trafficTracker.record(event);
    const set = this.listeners[event];
    if (set) {
      set.forEach((cb) => {
        (cb as EventCallback<GameEventMap[K]>)(payload);
      });
    }
  }

  public getTraffic(): Map<string, number> {
    return this.trafficTracker.getTraffic();
  }

  public clearTraffic(): void {
    this.trafficTracker.clear();
  }

  public clear(): void {
    this.listeners = {};
    this.trafficTracker.clear();
  }
}
