import { ISystem } from "../../contracts/ISystem";
import { IReadablePhysics, IWritablePhysics } from "../../contracts/IPhysicsWorld";

export class RapierWorldSystem implements ISystem, IReadablePhysics, IWritablePhysics {
    private transforms: Map<string, { x: number; y: number; z: number; qx: number; qy: number; qz: number; qw: number }> = new Map();
    private velocities: Map<string, { x: number; y: number; z: number }> = new Map();

    public init(): void {
        this.transforms.set("player", { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 });
        this.transforms.set("warden", { x: 10, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 });
    }

    public update(dt: number): void {
        // Authoritative Rapier world.step(dt) executes here
    }

    public getTransform(entityId: string) {
        return this.transforms.get(entityId) || null;
    }

    public applyImpulse(entityId: string, x: number, y: number, z: number): void {
        // Apply impulse to Rapier rigid body
    }

    public setKinematicVelocity(entityId: string, x: number, y: number, z: number): void {
        this.velocities.set(entityId, { x, y, z });
    }
}
