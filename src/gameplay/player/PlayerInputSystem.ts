import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { InputIntentComponent, HealthComponent } from "../../core/ecs/Components";

export class PlayerInputSystem implements ISystem {
  readonly phase = SystemPhase.Input;
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

    const healths = this.context.stores.get<HealthComponent>("health");
    const pHealth = healths.get(this.context.refs.player);
    const wHealth = healths.get(this.context.refs.weaver);

    if ((pHealth && pHealth.current <= 0) || (wHealth && wHealth.current <= 0)) {
      input.x = 0;
      input.y = 0;
      
      return;
    }

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
    this.keysPressed[e.key.toLowerCase()] = true;
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysPressed[e.key.toLowerCase()] = false;
  };
}
