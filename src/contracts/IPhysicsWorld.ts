export interface IReadablePhysics {
    getTransform(entityId: string): { x: number; y: number; z: number; qx: number; qy: number; qz: number; qw: number } | null;
}

export interface IWritablePhysics {
    applyImpulse(entityId: string, x: number, y: number, z: number): void;
    setKinematicVelocity(entityId: string, x: number, y: number, z: number): void;
}
