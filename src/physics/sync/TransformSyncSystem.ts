import { ISystem } from "../../contracts/ISystem";
import { IReadablePhysics } from "../../contracts/IPhysicsWorld";

export class TransformSyncSystem implements ISystem {
    constructor(private physics: IReadablePhysics) {}

    public update(dt: number): void {
        // Reads Rapier transforms and writes to Babylon mesh position buffers
    }
}
