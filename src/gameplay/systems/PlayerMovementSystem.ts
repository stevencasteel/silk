import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";

export class PlayerMovementSystem implements ISystem {
    readonly phase = SystemPhase.Intents;
    public update(_dt: number): void { void _dt; }
}
