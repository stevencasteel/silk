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

export class SystemContext {
  public readonly visualQuery: IVisualQuery;
  public readonly visualRegistration: IVisualRegistration;

  constructor(
    public readonly world: IEcsWorld,
    public readonly broker: IEventBroker,
    public readonly commands: ICommandBus,
    public readonly refs: IEntityRefs,
    public readonly visualRegistry: IVisualRegistry,
    public readonly stores: IStoreContainer
  ) {
    this.visualQuery = visualRegistry;
    this.visualRegistration = visualRegistry;
  }
}
