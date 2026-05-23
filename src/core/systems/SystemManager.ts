import { ISystem } from "../../contracts/ISystem";
import { Profiler } from "../diagnostics/Profiler";
import { InitPhase } from "../../contracts/SystemPhase";

export class SystemManager {
  private systems: ISystem[] = [];
  private systemNames: Map<ISystem, string> = new Map();

  constructor(private profiler: Profiler) {}

  public register(system: ISystem): void {
    this.systems.push(system);
    this.systemNames.set(system, system.constructor.name);
    this.systems.sort((a, b) => a.phase - b.phase);
  }

  public async initAll(): Promise<void> {
    const sortedForInit = [...this.systems].sort((a, b) => {
      const phaseA = a.initPhase ?? InitPhase.Gameplay;
      const phaseB = b.initPhase ?? InitPhase.Gameplay;
      return phaseA - phaseB;
    });

    for (const system of sortedForInit) {
      if (system.init) {
        await system.init();
      }
    }
  }

  public updateAll(dt: number): void {
    this.profiler.clearFrame();
    this.profiler.beginFrame();
    for (const system of this.systems) {
      if (system.update) {
        const start = performance.now();
        try {
          system.update(dt);
        } catch (err) {
          console.error(`System ${this.systemNames.get(system)} crashed during update:`, err);
        }
        this.profiler.recordSystem(this.systemNames.get(system)!, performance.now() - start);
      }
    }
  }

  public renderAll(alpha: number): void {
    for (const system of this.systems) {
      if (system.render) {
        const start = performance.now();
        try {
          system.render(alpha);
        } catch (err) {
          console.error(`System ${this.systemNames.get(system)} crashed during render:`, err);
        }
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
