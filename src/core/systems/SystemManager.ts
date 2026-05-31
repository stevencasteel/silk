import {
  ISystem,
  isInitializable,
  isUpdateable,
  isRenderable,
  isDisposable
} from "../../contracts/ISystem";
import { IProfiler } from "../diagnostics/IProfiler";
import { InitPhase } from "../../contracts/SystemPhase";
import { ISystemSortStrategy, DefaultSystemSortStrategy } from "./ISystemSortStrategy";

export class SystemManager {
  private systems: ISystem[] = [];
  private systemNames: Map<ISystem, string> = new Map();

  constructor(
    private profiler: IProfiler,
    private sortStrategy: ISystemSortStrategy = new DefaultSystemSortStrategy()
  ) {}

  public register(system: ISystem): void {
    this.systems.push(system);
    this.systemNames.set(system, system.constructor.name);
    this.systems = this.sortStrategy.sortByPhase(this.systems);
  }

  public async initAll(
    onProgress?: (phase: InitPhase, systemName: string, progress: number) => void
  ): Promise<void> {
    const sortedForInit = this.sortStrategy.sortByInitPhase(this.systems);

    const totalSystems = sortedForInit.length;
    let completedSystems = 0;

    for (const system of sortedForInit) {
      if (isInitializable(system)) {
        const phase = system.initPhase ?? InitPhase.Gameplay;
        const systemName = this.systemNames.get(system) || system.constructor.name;

        if (onProgress) {
          onProgress(phase, systemName, completedSystems / totalSystems);
        }

        await system.init();
        completedSystems++;

        if (onProgress) {
          onProgress(phase, systemName, completedSystems / totalSystems);
        }
      }
    }
  }

  private executeWithProfiling<T extends ISystem>(
    system: T,
    operation: (system: T) => void,
    phaseSuffix: string
  ): void {
    const isProfiling = this.profiler.isEnabled;
    const start = isProfiling ? performance.now() : 0;
    try {
      operation(system);
    } catch (err) {
      console.error(`System ${this.systemNames.get(system)} crashed during ${phaseSuffix}:`, err);
    }
    if (isProfiling) {
      this.profiler.recordSystem(
        this.systemNames.get(system)! + phaseSuffix,
        performance.now() - start
      );
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
        this.executeWithProfiling(system, (s) => s.update(dt), "");
      }
    }
  }

  public renderAll(alpha: number): void {
    const isProfiling = this.profiler.isEnabled;
    for (let i = 0; i < this.systems.length; i++) {
      const system = this.systems[i];
      if (isRenderable(system)) {
        this.executeWithProfiling(system, (s) => s.render(alpha), " (Render)");
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
