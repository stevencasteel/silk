import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { Profiler } from "./Profiler";
import { EventBroker } from "../events/EventBroker";
import { EcsWorld } from "../ecs/EcsWorld";
import { EntityRefs } from "../ecs/EntityRefs";
import { ComponentStore } from "../ecs/ComponentStore";
import { TransformComponent, TetherComponent, KinematicVelocityComponent } from "../ecs/Components";
import { GameEvent } from "../events/GameEvents";

export class DebugTelemetryOverlay implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private overlay: HTMLElement | null = null;
  private sysText: HTMLElement | null = null;
  private unsubscribes: (() => void)[] = [];
  private isGameOver: boolean = false;
  private isPaused: boolean = false;

  constructor(
    private _profiler: Profiler,
    private _broker: EventBroker,
    private _entities: EcsWorld,
    private _refs: EntityRefs,
    private _transforms: ComponentStore<TransformComponent>,
    private _tethers: ComponentStore<TetherComponent>,
    private _velocities: ComponentStore<KinematicVelocityComponent>
  ) {}

  public init(): void {
    if (typeof document === "undefined") return;
    this._profiler.isEnabled = true;
    this.overlay = document.createElement("div");

    this.overlay.style.cssText =
      "position:absolute;top:10px;left:10px;right:auto;background:rgba(10,12,18,0.92);color:#0f0;font-family:monospace;font-size:11px;padding:12px;z-index:9999;pointer-events:none;min-width:230px;border:1px solid #14161f;border-radius:6px;line-height:1.4;";

    this.sysText = document.createElement("pre");
    this.sysText.style.margin = "0";
    this.overlay.appendChild(this.sysText);
    document.body.appendChild(this.overlay);

    this.unsubscribes.push(
      this._broker.subscribe(GameEvent.USER_GESTURE_REGISTERED, () => {
        if (this.overlay) this.overlay.style.display = "block";
      })
    );

    this.unsubscribes.push(
      this._broker.subscribe(GameEvent.GAME_OVER, () => {
        this.isGameOver = true;
      })
    );

    this.unsubscribes.push(
      this._broker.subscribe(GameEvent.GAME_RESET, () => {
        this.isGameOver = false;
      })
    );

    this.unsubscribes.push(
      this._broker.subscribe(GameEvent.GAME_PAUSED, ({ isPaused }) => {
        this.isPaused = isPaused;
      })
    );

    if (this.overlay) this.overlay.style.display = "none";
  }

  public update(): void {
    if (!this.overlay || this.overlay.style.display === "none") return;

    const fps = this._profiler.getFps();
    const frameTime = this._profiler.getFrameTime().toFixed(1);

    const playerTrans = this._transforms.get(this._refs.player);
    const playerTether = this._tethers.get(this._refs.player);
    const weaverTrans = this._transforms.get(this._refs.weaver);
    const weaverVel = this._velocities.get(this._refs.weaver);

    let info = `=== PROJECT SILK DIAGNOSTICS ===\n`;
    info += `FPS        : ${fps} (Frame: ${frameTime}ms)\n`;
    info += `Entities   : ${this._entities.count()}\n\n`;

    if (playerTrans && playerTether) {
      const spd = Math.sqrt(
        playerTether.dynamicVelX * playerTether.dynamicVelX +
          playerTether.dynamicVelY * playerTether.dynamicVelY
      );
      info += `=== PLAYER STATE ===\n`;
      info += `Pos X/Y    : ${playerTrans.x.toFixed(2)}, ${playerTrans.y.toFixed(2)}\n`;
      info += `Vel X/Y    : ${playerTether.dynamicVelX.toFixed(2)}, ${playerTether.dynamicVelY.toFixed(2)}\n`;
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
    this.unsubscribes.forEach((unsub) => unsub());
    this.unsubscribes = [];
    if (this.overlay && this.overlay.parentNode) this.overlay.parentNode.removeChild(this.overlay);
  }
}
