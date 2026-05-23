import { EntityId } from "../core/ecs/Entity";
export interface PhysicsTransform {
    x: number; y: number; z: number;
    qx: number; qy: number; qz: number; qw: number;
}
export interface IReadablePhysics {
    getTransform(id: EntityId): PhysicsTransform | null;
    getPreviousTransform(id: EntityId): PhysicsTransform | null;
}
