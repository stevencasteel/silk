import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { InputIntentComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";

export class PlayerInputSystem implements ISystem {
  readonly phase = SystemPhase.Input;
  private keysPressed: Set<string> = new Set();

  constructor(private refs: EntityRefs, private inputs: ComponentStore<InputIntentComponent>) {}

  public init(): void {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  public update(_dt: number): void {
    void _dt;
    const input = this.inputs.get(this.refs.player);
    if (!input) return;

    let x = 0, y = 0;
    if (this.keysPressed.has("w") || this.keysPressed.has("arrowup")) y += 1;
    if (this.keysPressed.has("s") || this.keysPressed.has("arrowdown")) y -= 1;
    if (this.keysPressed.has("a") || this.keysPressed.has("arrowleft")) x -= 1;
    if (this.keysPressed.has("d") || this.keysPressed.has("arrowright")) x += 1;

    input.x = x; 
    input.y = y;
    input.jump = this.keysPressed.has(" ");
    input.detach = this.keysPressed.has("e") || this.keysPressed.has("q");
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent): void => { this.keysPressed.add(e.key.toLowerCase()); };
  private handleKeyUp = (e: KeyboardEvent): void => { this.keysPressed.delete(e.key.toLowerCase()); };
}
