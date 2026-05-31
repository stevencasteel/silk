import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { InputIntentComponent } from "../../core/ecs/Components";
import { GameEvent } from "../../core/events/GameEvents";

export class PlayerInputSystem implements ISystem {
  readonly phase = SystemPhase.Input;
  readonly initPhase = InitPhase.Bootstrap;
  private keysPressed: Record<string, boolean> = {};

  constructor(private context: SystemContext) {}

  public init(): void {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
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

    input.x = x;
    input.y = y;
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.keysPressed = {};
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
}
