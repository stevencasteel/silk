import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { GameEvent } from "../../core/events/GameEvents";
import { SubscriptionTracker } from "../../core/utils/EngineUtils";


interface DualRumbleActuator {
  type: string;
  playEffect: (type: "dual-rumble", params: {
    startDelay: number;
    duration: number;
    strongMagnitude: number;
    weakMagnitude: number;
  }) => Promise<void>;
}

export class HapticFeedbackSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;
  private _tracker = new SubscriptionTracker();

  constructor(private context: SystemContext) {}

  public init(): void {
    // 1. Sync heavy/dynamic rumble perfectly with camera shake (covers hits, flings, explosions, death)
    this._tracker.add(
      this.context.broker.subscribe(GameEvent.CAMERA_SHAKE_TRIGGERED, (payload) => {
        // Map camera shake amplitude to motor magnitude (cap at 1.0)
        const magnitude = Math.min(1.0, payload.amplitude * 0.6);
        const durationMs = payload.duration * 1000;
        
        // High amplitude shakes use more strong motor, low amplitude uses more weak motor
        this.triggerRumble(durationMs, magnitude, magnitude * 0.8);
      })
    );

    // 2. Add subtle tactile feedback for wall clinging/hitting
    this._tracker.add(
      this.context.broker.subscribe(GameEvent.PLAYER_WALL_HIT, () => {
        this.triggerRumble(60, 0.05, 0.2);
      })
    );

    // 3. UI Confirm / Release Fling feedback
    this._tracker.add(
      this.context.broker.subscribe(GameEvent.UI_SFX_CONFIRM, () => {
        this.triggerRumble(40, 0.0, 0.3);
      })
    );
    
    // 4. Overloaded Tension Alarm warning
    this._tracker.add(
      this.context.broker.subscribe(GameEvent.UI_SFX_ALARM, () => {
        this.triggerRumble(80, 0.4, 0.9);
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
        
        // Cast to any to access the standard but poorly-typed experimental vibration actuator
        const actuator = (pad.vibrationActuator as unknown) as DualRumbleActuator | null;
        if (actuator && actuator.type === "dual-rumble") {
          actuator.playEffect("dual-rumble", {
            startDelay: 0,
            duration: durationMs,
            strongMagnitude: Math.max(0, Math.min(1, strongMag)),
            weakMagnitude: Math.max(0, Math.min(1, weakMag))
          }).catch(() => { /* Ignore browser policy blocks / disconnections */ });
        }
      }
    } catch {
      // Fail silently for environments that do not fully support the Gamepad API
    }
  }

  public update(): void {
    // Event-driven system, no frame updates needed
  }

  public dispose(): void {
    this._tracker.clear();
  }
}
