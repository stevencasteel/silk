import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { Profiler } from "./Profiler";
import { EventBroker } from "../events/EventBroker";
import { EntityRegistry } from "../ecs/Entity";
import { GameEvent } from "../events/GameEvents";

export class DebugTelemetryOverlay implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private overlay: HTMLElement | null = null;
  private fpsText: HTMLElement | null = null;
  private sysText: HTMLElement | null = null;
  private unsub: (() => void) | null = null;

  constructor(
    private _profiler: Profiler,
    private _broker: EventBroker,
    private _entities: EntityRegistry
  ) {}

  public init(): void {
    if (typeof document === "undefined") return;
    this.overlay = document.createElement("div");
    this.overlay.style.cssText = "position:absolute;top:10px;right:10px;background:rgba(0,0,0,0.8);color:#0f0;font-family:monospace;font-size:10px;padding:8px;z-index:9999;pointer-events:none;min-width:200px;";
    
    this.fpsText = document.createElement("div");
    this.sysText = document.createElement("div");
    this.overlay.appendChild(this.fpsText);
    this.overlay.appendChild(this.sysText);
    document.body.appendChild(this.overlay);

    this.unsub = this._broker.subscribe(GameEvent.USER_GESTURE_REGISTERED, () => {
      if (this.overlay) this.overlay.style.display = "block";
    });
    if (this.overlay) this.overlay.style.display = "none"; 
  }

  public update(_dt: number): void {
    void _dt;
    if (!this.overlay || this.overlay.style.display === "none") return;
    
    const fps = this._profiler.getFps();
    const frameTime = this._profiler.getFrameTime().toFixed(2);
    if (this.fpsText) this.fpsText.textContent = `FPS: ${fps} | Frame: ${frameTime}ms`;

    if (this.sysText) {
      let txt = "Entities: " + this._entities.count() + "\n";
      const timings = this._profiler.getSystemTimings();
      for (const [name, time] of timings) {
        txt += `${name.padEnd(20)} ${time.toFixed(2)}ms\n`;
      }
      this.sysText.textContent = txt;
    }
  }

  public dispose(): void {
    if (this.unsub) this.unsub();
    if (this.overlay && this.overlay.parentNode) this.overlay.parentNode.removeChild(this.overlay);
  }
}
