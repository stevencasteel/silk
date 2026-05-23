import { ISystem } from "../../contracts/ISystem";

export class PlayerInputSystem implements ISystem {
    private keysPressed: Set<string> = new Set();
    public readonly inputBuffer = { x: 0, y: 0, jump: false, fire: false };

    public init(): void {
        window.addEventListener("keydown", this.handleKeyDown);
        window.addEventListener("keyup", this.handleKeyUp);
    }

    public update(dt: number): void {
        let x = 0;
        let y = 0;
        if (this.keysPressed.has("w") || this.keysPressed.has("arrowup")) y += 1;
        if (this.keysPressed.has("s") || this.keysPressed.has("arrowdown")) y -= 1;
        if (this.keysPressed.has("a") || this.keysPressed.has("arrowleft")) x -= 1;
        if (this.keysPressed.has("d") || this.keysPressed.has("arrowright")) x += 1;
        
        this.inputBuffer.x = x;
        this.inputBuffer.y = y;
        this.inputBuffer.jump = this.keysPressed.has(" ");
    }

    public dispose(): void {
        window.removeEventListener("keydown", this.handleKeyDown);
        window.removeEventListener("keyup", this.handleKeyUp);
    }

    private handleKeyDown = (e: KeyboardEvent): void => {
        this.keysPressed.add(e.key.toLowerCase());
    };

    private handleKeyUp = (e: KeyboardEvent): void => {
        this.keysPressed.delete(e.key.toLowerCase());
    };
}
