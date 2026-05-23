import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { WardenAIComponent, TransformComponent, WardenTraversalComponent, HealthComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { CommandBus } from "../../core/commands/CommandBus";

export class WardenBrainSystem implements ISystem {
  readonly phase = SystemPhase.Intents;

  constructor(
    private refs: EntityRefs,
    private ai: ComponentStore<WardenAIComponent>,
    _transforms: ComponentStore<TransformComponent>,
    _wardenTraversal: ComponentStore<WardenTraversalComponent>,
    _healths: ComponentStore<HealthComponent>,
    private broker: EventBroker,
    _commands: CommandBus
  ) {
    void _transforms;
    void _wardenTraversal;
    void _healths;
    void _commands;
  }

  public init(): void {
    const aiComp = this.ai.get(this.refs.warden);
    if (aiComp) {
      aiComp.state = "SWEEPING";
      aiComp.hue = "#ef4444";
    }
    this.broker.publish(GameEvent.WARDEN_STATE_CHANGE, { state: "SWEEPING", hue: "#ef4444" });
  }

  public update(dt: number): void {
    void dt;
  }
}
