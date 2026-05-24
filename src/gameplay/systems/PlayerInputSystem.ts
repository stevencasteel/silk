import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { InputIntentComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";

export class PlayerInputSystem implements ISystem {
  readonly phase = SystemPhase.Input;
  private keysPressed: Record<string, boolean> = {};

  constructor(
    private refs: EntityRefs,
    private inputs: ComponentStore<InputIntentComponent>
  ) {}

  public init(): void {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  public update(): void {
    const input = this.inputs.get(this.refs.player);
    if (!input) return;

    let x = 0;
    if (this.keysPressed["a"] || this.keysPressed["arrowleft"]) x -= 1;
    if (this.keysPressed["d"] || this.keysPressed["arrowright"]) x += 1;

    input.x = x;
    input.y = 0;
    input.jump = !!(this.keysPressed[" "] || this.keysPressed["w"] || this.keysPressed["arrowup"]);
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
