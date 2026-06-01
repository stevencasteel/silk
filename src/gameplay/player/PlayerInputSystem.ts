import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { InputIntentComponent } from "../../core/ecs/Components";
import { GameEvent } from "../../core/events/GameEvents";
import { useOverlayStore } from "../../ui/hud/hudStore";

export class PlayerInputSystem implements ISystem {
  readonly phase = SystemPhase.Input;
  readonly initPhase = InitPhase.Bootstrap;
  private keysPressed: Record<string, boolean> = {};
  private activePointers = new Map<number, { clientX: number; clientY: number }>();

  constructor(private context: SystemContext) {}

  public init(): void {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointercancel", this.handlePointerCancel);
  }

  public update(): void {
    const inputStore = this.context.stores.get<InputIntentComponent>("input");
    const input = inputStore.get(this.context.refs.player);
    if (!input) return;

    let x = 0;
    if (this.keysPressed["a"] || this.keysPressed["arrowleft"]) x -= 1;
    if (this.keysPressed["d"] || this.keysPressed["arrowright"]) x += 1;

    let y = 0;
    if (this.keysPressed["w"] || this.keysPressed["arrowup"]) y += 1;
    if (this.keysPressed["s"] || this.keysPressed["arrowdown"]) y -= 1;

    let touchLeft = false;
    let touchRight = false;
    let touchMiddle = false;

    const overlay = useOverlayStore.getState();
    const ignoreTouch = overlay.overlayVisible || overlay.awaitingGesture || overlay.isPaused;

    if (ignoreTouch) {
      if (this.activePointers.size > 0) {
        this.activePointers.clear();
      }
    } else {
      this.activePointers.forEach((ptr) => {
        const ratio = ptr.clientX / window.innerWidth;
        if (ratio < 1 / 3) {
          touchLeft = true;
        } else if (ratio > 2 / 3) {
          touchRight = true;
        } else {
          touchMiddle = true;
        }
      });
    }

    if (touchLeft) x -= 1;
    if (touchRight) x += 1;
    if (touchMiddle) y += 1;

    input.x = Math.max(-1, Math.min(1, x));
    input.y = Math.max(-1, Math.min(1, y));
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("pointerdown", this.handlePointerDown);
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointercancel", this.handlePointerCancel);
    this.keysPressed = {};
    this.activePointers.clear();
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    this.keysPressed[key] = true;
    this.context.broker.publish(GameEvent.PLAYER_INPUT_KEY_STATE_CHANGED, {
      key,
      code: e.code.toLowerCase(),
      pressed: true
    });
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    this.keysPressed[key] = false;
    this.context.broker.publish(GameEvent.PLAYER_INPUT_KEY_STATE_CHANGED, {
      key,
      code: e.code.toLowerCase(),
      pressed: false
    });
  };

  private handlePointerDown = (e: PointerEvent): void => {
    const overlay = useOverlayStore.getState();
    const ignoreTouch = overlay.overlayVisible || overlay.awaitingGesture || overlay.isPaused;
    if (ignoreTouch) return;

    const target = e.target as HTMLElement | null;
    if (target && target.closest(".hud-root, .overlay-root, #debug-telemetry-root")) {
      return;
    }

    this.activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (this.activePointers.has(e.pointerId)) {
      this.activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    this.activePointers.delete(e.pointerId);
  };

  private handlePointerCancel = (e: PointerEvent): void => {
    this.activePointers.delete(e.pointerId);
  };
}
