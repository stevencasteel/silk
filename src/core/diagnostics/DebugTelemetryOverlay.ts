import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { Profiler } from "./Profiler";
import { TransformComponent, TetherComponent, KinematicVelocityComponent } from "../ecs/Components";
import { GameEvent } from "../events/GameEvents";
import { SystemContext } from "../engine/SystemContext";
import { SubscriptionTracker } from "../utils/EngineUtils";

export class DebugTelemetryOverlay implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private overlay: HTMLElement | null = null;
  private sysText: HTMLElement | null = null;
  private _tracker = new SubscriptionTracker();
  private isGameOver: boolean = false;
  private isPaused: boolean = false;

  constructor(
    private _profiler: Profiler,
    private context: SystemContext
  ) {}

  public init(): void {
    if (typeof document === "undefined") return;
    this._profiler.isEnabled = true;
    const root = document.getElementById("debug-telemetry-root");
    if (!root) return;

    this.overlay = document.createElement("div");

    this.overlay.style.cssText =
      "position:absolute;top:10px;left:10px;right:auto;background:rgba(10,12,18,0.92);color:#0f0;font-family:monospace;font-size:11px;padding:12px;z-index:10;pointer-events:none;min-width:230px;border:1px solid #14161f;border-radius:6px;line-height:1.4;";

    this.sysText = document.createElement("pre");
    this.sysText.style.margin = "0";
    this.overlay.appendChild(this.sysText);
    root.appendChild(this.overlay);

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.USER_GESTURE_REGISTERED, () => {
        if (this.overlay) this.overlay.style.display = "block";
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_OVER, () => {
        this.isGameOver = true;
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.isGameOver = false;
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.GAME_PAUSED, ({ isPaused }) => {
        this.isPaused = isPaused;
      })
    );

    if (this.overlay) this.overlay.style.display = "none";
  }

  public update(): void {
    if (!this.overlay || this.overlay.style.display === "none") return;

    const fps = this._profiler.getFps();
    const frameTime = this._profiler.getFrameTime().toFixed(1);

    const transforms = this.context.stores.get<TransformComponent>("transform");
    const tethers = this.context.stores.get<TetherComponent>("tether");
    const velocities = this.context.stores.get<KinematicVelocityComponent>("velocity");

    const playerTrans = transforms.get(this.context.refs.player);
    const playerTether = tethers.get(this.context.refs.player);
    const playerVel = velocities.get(this.context.refs.player);
    const weaverTrans = transforms.get(this.context.refs.weaver);
    const weaverVel = velocities.get(this.context.refs.weaver);

    let info = `=== PROJECT SILK DIAGNOSTICS ===\n`;
    info += `FPS        : ${fps} (Frame: ${frameTime}ms)\n`;
    info += `Entities   : ${this.context.world.count()}\n\n`;

    if (playerTrans && playerTether && playerVel) {
      const spd = Math.sqrt(playerVel.x * playerVel.x + playerVel.y * playerVel.y);
      info += `=== PLAYER STATE ===\n`;
      info += `Pos X/Y    : ${playerTrans.x.toFixed(2)}, ${playerTrans.y.toFixed(2)}\n`;
      info += `Vel X/Y    : ${playerVel.x.toFixed(2)}, ${playerVel.y.toFixed(2)}\n`;
      info += `Speed      : ${spd.toFixed(2)} units/s\n\n`;

      info += `=== TETHER ===\n`;
      info += `Length     : ${playerTether.currentLength.toFixed(2)} / ${playerTether.maxLength.toFixed(1)}\n`;
      info += `Load/Tens  : ${(playerTether.tension * 100).toFixed(1)}%\n`;
    }

    if (weaverTrans && weaverVel) {
      info += `\n=== WEAVER CEILING ANCHOR ===\n`;
      info += `Pos X/Y    : ${weaverTrans.x.toFixed(2)}, ${weaverTrans.y.toFixed(2)}\n`;
      info += `Vel X      : ${weaverVel.x.toFixed(2)} units/s\n`;
    }

    info += `\n=== SYSTEM SHORTCUTS ===\n`;
    info += `[P] TOGGLE PAUSE : ${this.isPaused ? "PAUSED (PRESS P TO RESUME)" : "PLAYING"}\n`;
    info += `[R] RESET GAME   : ${this.isGameOver ? "ACTIVE (PRESS R NOW)" : "STANDBY"}\n`;
    info += `[K] KILL WEAVER  : TRIGGER DEATH CINEMATIC\n`;

    if (this.sysText) {
      this.sysText.textContent = info;
    }
  }

  public dispose(): void {
    this._tracker.clear();
    if (this.overlay && this.overlay.parentNode) this.overlay.parentNode.removeChild(this.overlay);
  }
}
