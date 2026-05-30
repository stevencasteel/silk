import {
  ISystem,
  isInitializable,
  isUpdateable,
  isRenderable,
  isDisposable
} from "../../contracts/ISystem";
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
      if (isInitializable(system)) {
        await system.init();
      }
    }
  }

  public updateAll(dt: number): void {
    const isProfiling = this.profiler.isEnabled;
    if (isProfiling) {
      this.profiler.clearFrame();
      this.profiler.beginFrame();
    }

    for (let i = 0; i < this.systems.length; i++) {
      const system = this.systems[i];

      if (isUpdateable(system)) {
        const start = isProfiling ? performance.now() : 0;
        try {
          system.update(dt);
        } catch (err) {
          console.error(`System ${this.systemNames.get(system)} crashed during update:`, err);
        }
        if (isProfiling) {
          this.profiler.recordSystem(this.systemNames.get(system)!, performance.now() - start);
        }
      }
    }
  }

  public renderAll(alpha: number): void {
    const isProfiling = this.profiler.isEnabled;
    for (let i = 0; i < this.systems.length; i++) {
      const system = this.systems[i];
      if (isRenderable(system)) {
        const start = isProfiling ? performance.now() : 0;
        try {
          system.render(alpha);
        } catch (err) {
          console.error(`System ${this.systemNames.get(system)} crashed during render:`, err);
        }
        if (isProfiling) {
          this.profiler.recordSystem(
            this.systemNames.get(system)! + " (Render)",
            performance.now() - start
          );
        }
      }
    }
    if (isProfiling) {
      this.profiler.endFrame();
    }
  }

  public disposeAll(): void {
    for (const system of this.systems) {
      if (isDisposable(system)) {
        system.dispose();
      }
    }
  }
}
