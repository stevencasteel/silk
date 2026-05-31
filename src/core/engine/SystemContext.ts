import {
  IEcsWorld,
  IEventBroker,
  ICommandBus,
  IStoreContainer,
  IEntityRefs
} from "../../contracts/ICore";
import {
  IVisualRegistry,
  IVisualQuery,
  IVisualRegistration
} from "../../contracts/IVisualRegistry";
import { RuntimeState } from "./RuntimeState";

export class SystemContext {
  public readonly visualQuery: IVisualQuery;
  public readonly visualRegistration: IVisualRegistration;

  constructor(
    public readonly world: IEcsWorld,
    public readonly broker: IEventBroker,
    public readonly commands: ICommandBus,
    public readonly refs: IEntityRefs,
    public readonly visualRegistry: IVisualRegistry,
    public readonly stores: IStoreContainer,
    public readonly runtime: RuntimeState
  ) {
    this.visualQuery = visualRegistry;
    this.visualRegistration = visualRegistry;
  }
}
