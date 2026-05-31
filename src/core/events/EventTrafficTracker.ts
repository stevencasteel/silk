export class EventTrafficTracker {
  private traffic: Map<string, number> = new Map();

  public record(event: string): void {
    this.traffic.set(event, (this.traffic.get(event) || 0) + 1);
  }

  public getTraffic(): Map<string, number> {
    return this.traffic;
  }

  public clear(): void {
    this.traffic.clear();
  }
}
