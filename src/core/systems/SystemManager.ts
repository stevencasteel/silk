import { ISystem } from "../../contracts/ISystem";

export class SystemManager {
    private systems: ISystem[] = [];

    public register(system: ISystem): void {
        this.systems.push(system);
    }

    public initAll(): void {
        for (const system of this.systems) {
            if (system.init) system.init();
        }
    }

    public updateAll(dt: number): void {
        for (const system of this.systems) {
            system.update(dt);
        }
    }

    public renderAll(alpha: number): void {
        for (const system of this.systems) {
            if (system.render) system.render(alpha);
        }
    }

    public disposeAll(): void {
        for (const system of this.systems) {
            if (system.dispose) system.dispose();
        }
    }
}
