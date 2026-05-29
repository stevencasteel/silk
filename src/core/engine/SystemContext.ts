import { EcsWorld } from "../ecs/EcsWorld";
import { EventBroker } from "../events/EventBroker";
import { CommandBus } from "../commands/CommandBus";
import { EntityRefs } from "../ecs/EntityRefs";
import { IVisualRegistry, IVisualQuery, IVisualRegistration } from "../../contracts/IVisualRegistry";
import { StoreContainer } from "../ecs/StoreContainer";

export class SystemContext {
  public readonly visualQuery: IVisualQuery;
  public readonly visualRegistration: IVisualRegistration;

  constructor(
    public readonly world: EcsWorld,
    public readonly broker: EventBroker,
    public readonly commands: CommandBus,
    public readonly refs: EntityRefs,
    public readonly visualRegistry: IVisualRegistry,
    public readonly stores: StoreContainer
  ) {
    this.visualQuery = visualRegistry;
    this.visualRegistration = visualRegistry;
  }
}
