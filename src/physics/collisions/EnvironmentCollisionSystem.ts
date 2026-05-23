import { ISystem } from "../../contracts/ISystem";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TetherComponent, KinematicTargetComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { PLATFORM_AABBS } from "./EnvironmentColliders";

export class EnvironmentCollisionSystem implements ISystem {
    private borderX = 14.0;
    private minY = 1.0;
    private maxY = 28.0;

    constructor(
        private refs: EntityRefs,
        private tethers: ComponentStore<TetherComponent>,
        private targets: ComponentStore<KinematicTargetComponent>
    ) {}

    public update(dt: number): void {
        const tether = this.tethers.get(this.refs.player);
        const target = this.targets.get(this.refs.player);
        if (!tether || !target) return;

        let nextX = target.x;
        let nextY = target.y;
        const playerHalfW = 0.5;
        const playerHalfH = 1.0;

        for (const plat of PLATFORM_AABBS) {
            const overlapX = (nextX + playerHalfW > plat.minX) && (nextX - playerHalfW < plat.maxX);
            const overlapY = (nextY + playerHalfH > plat.minY) && (nextY - playerHalfH < plat.maxY);
            if (overlapX && overlapY) {
                const overlapDepthX = Math.min(nextX + playerHalfW - plat.minX, plat.maxX - (nextX - playerHalfW));
                const overlapDepthY = Math.min(nextY + playerHalfH - plat.minY, plat.maxY - (nextY - playerHalfH));
                if (overlapDepthY < overlapDepthX) {
                    if (nextY > (plat.minY + plat.maxY) / 2) {
                        nextY = plat.maxY + playerHalfH;
                        if (tether.dynamicVelY < 0) tether.dynamicVelY = 0;
                    } else {
                        nextY = plat.minY - playerHalfH;
                        if (tether.dynamicVelY > 0) tether.dynamicVelY = 0;
                    }
                } else {
                    if (nextX > (plat.minX + plat.maxX) / 2) {
                        nextX = plat.maxX + playerHalfW;
                        tether.dynamicVelX = 0;
                    } else {
                        nextX = plat.minX - playerHalfW;
                        tether.dynamicVelX = 0;
                    }
                }
            }
        }

        if (nextX < -this.borderX) { nextX = -this.borderX; tether.dynamicVelX = 0; }
        if (nextX > this.borderX) { nextX = this.borderX; tether.dynamicVelX = 0; }
        if (nextY < this.minY) { nextY = this.minY; tether.dynamicVelY = 0; }
        if (nextY > this.maxY) { nextY = this.maxY; tether.dynamicVelY = 0; }

        target.x = nextX;
        target.y = nextY;
    }
}
