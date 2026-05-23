import { ISystem } from "../../contracts/ISystem";
import { Profiler } from "../diagnostics/Profiler";

export class SystemManager {
    private systems: ISystem[] = [];
    private systemNames: Map<ISystem, string> = new Map();
    
    constructor(private profiler: Profiler) {}

    public register(system: ISystem): void {
        this.systems.push(system);
        this.systemNames.set(system, system.constructor.name);
    }

    public async initAll(): Promise<void> {
        for (const system of this.systems) {
            if (system.init) {
                await system.init();
            }
        }
    }

    public updateAll(dt: number): void {
        this.profiler.clearFrame();
        this.profiler.beginFrame();
        for (const system of this.systems) {
            const start = performance.now();
            system.update(dt);
            this.profiler.recordSystem(this.systemNames.get(system)!, performance.now() - start);
        }
    }

    public renderAll(alpha: number): void {
        for (const system of this.systems) {
            if (system.render) {
                const start = performance.now();
                system.render(alpha);
                this.profiler.recordSystem(this.systemNames.get(system)! + " (Render)", performance.now() - start);
            }
        }
        this.profiler.endFrame();
    }

    public disposeAll(): void {
        for (const system of this.systems) {
            if (system.dispose) {
                system.dispose();
            }
        }
    }
}
