import { ISystem } from "../../contracts/ISystem";
import { PlayerData } from "../components/PlayerData";
import { PlayerInputSystem } from "./PlayerInputSystem";

export class PlayerMovementSystem implements ISystem {
    constructor(
        private playerData: PlayerData,
        private inputSystem: PlayerInputSystem
    ) {}

    public update(dt: number): void {
        const input = this.inputSystem.inputBuffer;
        const speed = this.playerData.moveSpeed;
        
        this.playerData.velocityX = input.x * speed;
        this.playerData.velocityY = input.y * speed;
    }
}
