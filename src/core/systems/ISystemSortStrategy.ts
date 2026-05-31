import { ISystem } from "../../contracts/ISystem";
import { InitPhase } from "../../contracts/SystemPhase";

export interface ISystemSortStrategy {
  sortByPhase(systems: ISystem[]): ISystem[];
  sortByInitPhase(systems: ISystem[]): ISystem[];
}

export class DefaultSystemSortStrategy implements ISystemSortStrategy {
  public sortByPhase(systems: ISystem[]): ISystem[] {
    return [...systems].sort((a, b) => a.phase - b.phase);
  }

  public sortByInitPhase(systems: ISystem[]): ISystem[] {
    return [...systems].sort((a, b) => {
      const phaseA = a.initPhase ?? InitPhase.Gameplay;
      const phaseB = b.initPhase ?? InitPhase.Gameplay;
      return phaseA - phaseB;
    });
  }
}
