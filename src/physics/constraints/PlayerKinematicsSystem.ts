import { ISystem } from "../../contracts/ISystem";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TetherComponent, KinematicVelocityComponent, KinematicTargetComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";

export class PlayerKinematicsSystem implements ISystem {
    constructor(
        private refs: EntityRefs,
        private tethers: ComponentStore<TetherComponent>,
        private velocities: ComponentStore<KinematicVelocityComponent>,
        private targets: ComponentStore<KinematicTargetComponent>
    ) {}

    public update(dt: number): void {
        const tether = this.tethers.get(this.refs.player);
        const vel = this.velocities.get(this.refs.player);
        const target = this.targets.get(this.refs.player);
        if (!tether || !vel || !target) return;

        let nextX = target.x;
        let nextY = target.y;

        if (tether.isAttached) {
            tether.dynamicVelY += -12.0 * dt;
            tether.dynamicVelX += vel.x * 2.5 * dt;
            tether.dynamicVelX *= Math.pow(0.985, dt * 60);
            tether.dynamicVelY *= Math.pow(0.985, dt * 60);

            nextX += tether.dynamicVelX * dt;
            nextY += tether.dynamicVelY * dt;

            const dx = nextX - tether.anchorX;
            const dy = nextY - tether.anchorY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > tether.maxLength) {
                const nx = dx / dist;
                const ny = dy / dist;
                nextX = tether.anchorX + nx * tether.maxLength;
                nextY = tether.anchorY + ny * tether.maxLength;
                const dot = tether.dynamicVelX * nx + tether.dynamicVelY * ny;
                if (dot > 0) {
                    tether.dynamicVelX -= dot * nx;
                    tether.dynamicVelY -= dot * ny;
                }
            }
            tether.currentLength = dist;
            tether.tension = Math.max(0, Math.min(1, dist / tether.maxLength));
        } else {
            tether.dynamicVelX = vel.x;
            tether.dynamicVelY = vel.y;
            nextX += tether.dynamicVelX * dt;
            nextY += tether.dynamicVelY * dt;
        }

        target.x = nextX;
        target.y = nextY;
    }
}
