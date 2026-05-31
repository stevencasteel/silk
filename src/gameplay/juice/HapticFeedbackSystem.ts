import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { GameEvent } from "../../core/events/GameEvents";
import { SubscriptionTracker } from "../../core/utils/EngineUtils";

interface DualRumbleActuator {
  type: string;
  playEffect: (
    type: "dual-rumble",
    params: {
      startDelay: number;
      duration: number;
      strongMagnitude: number;
      weakMagnitude: number;
    }
  ) => Promise<void>;
}

export class HapticFeedbackSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private _tracker = new SubscriptionTracker();

  constructor(private context: SystemContext) {}

  public init(): void {
    this._tracker.add(
      this.context.broker.subscribe(GameEvent.CAMERA_SHAKE_TRIGGERED, (payload) => {
        const magnitude = Math.min(1.0, payload.amplitude * 0.6);
        const durationMs = payload.duration * 1000;
        this.triggerRumble(durationMs, magnitude, magnitude * 0.8);
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.PLAYER_WALL_HIT, () => {
        this.triggerRumble(60, 0.05, 0.2);
      })
    );

    this._tracker.add(
      this.context.broker.subscribe(GameEvent.UI_SFX_CONFIRM, () => {
        this.triggerRumble(40, 0.0, 0.3);
      })
    );
  }

  private triggerRumble(durationMs: number, strongMag: number, weakMag: number): void {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return;

    try {
      const gamepads = navigator.getGamepads();
      for (let i = 0; i < gamepads.length; i++) {
        const pad = gamepads[i];
        if (!pad) continue;

        const actuator = pad.vibrationActuator as unknown as DualRumbleActuator | null;
        if (actuator && actuator.type === "dual-rumble") {
          actuator
            .playEffect("dual-rumble", {
              startDelay: 0,
              duration: durationMs,
              strongMagnitude: Math.max(0, Math.min(1, strongMag)),
              weakMagnitude: Math.max(0, Math.min(1, weakMag))
            })
            .catch(() => {});
        }
      }
    } catch {
      // Fail silently
    }
  }

  public update(): void {}

  public dispose(): void {
    this._tracker.clear();
  }
}
