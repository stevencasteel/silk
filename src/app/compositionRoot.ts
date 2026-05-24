import { Engine } from "../core/engine/Engine";
import { EventBroker } from "../core/events/EventBroker";
import { SystemManager } from "../core/systems/SystemManager";
import { CommandBus } from "../core/commands/CommandBus";
import { EntityRegistry } from "../core/ecs/Entity";
import { ComponentStore } from "../core/ecs/ComponentStore";
import { EntityRefs } from "../core/ecs/EntityRefs";
import {
  TransformComponent,
  KinematicVelocityComponent,
  KinematicTargetComponent,
  SilkComponent,
  HealthComponent,
  InputIntentComponent,
  WeaverAIComponent,
  PlayerTag,
  WeaverTag,
  TraversalStateComponent,
  InvulnerabilityComponent,
  WeaverTraversalComponent
} from "../core/ecs/Components";
import { RenderSystem } from "../babylon/scene/RenderSystem";
import { CameraSystem } from "../babylon/cameras/CameraSystem";
import { LightingSystem } from "../babylon/lighting/LightingSystem";
import { AudioDirectorSystem } from "../audio/systems/AudioDirectorSystem";
import { DomHudSystem } from "../ui/hud/DomHudSystem";
import { EntitySpawnerSystem } from "../gameplay/systems/EntitySpawnerSystem";
import { PlayerInputSystem } from "../gameplay/systems/PlayerInputSystem";
import { WeaverBrainSystem } from "../gameplay/systems/WeaverBrainSystem";
import { WeaverTraversalSystem } from "../gameplay/systems/WeaverTraversalSystem";
import { SilkVisualizerSystem } from "../gameplay/systems/SilkVisualizerSystem";
import { PlayerKinematicsSystem } from "../physics/constraints/PlayerKinematicsSystem";
import { EnvironmentCollisionSystem } from "../physics/collisions/EnvironmentCollisionSystem";
import { HavokPhysicsSystem } from "../physics/havok/HavokPhysicsSystem";
import { TransformSyncSystem } from "../physics/sync/TransformSyncSystem";
import { CombatSystem } from "../gameplay/systems/CombatSystem";
import { GameDirectorSystem } from "../gameplay/systems/GameDirectorSystem";
import { ProjectileSystem } from "../gameplay/systems/ProjectileSystem";
import { JuiceSystem } from "../babylon/particles/JuiceSystem";
import { Profiler } from "../core/diagnostics/Profiler";
import { DebugTelemetryOverlay } from "../core/diagnostics/DebugTelemetryOverlay";
import { PerformanceClock } from "../core/clock/PerformanceClock";
import { RafScheduler } from "../core/loop/RafScheduler";

export class CompositionRoot {
  public buildEngine(canvas: HTMLCanvasElement): Engine {
    const broker = new EventBroker();
    const commands = new CommandBus();
    const profiler = new Profiler();
    const systemManager = new SystemManager(profiler);

    const entities = new EntityRegistry();
    const transforms = new ComponentStore<TransformComponent>();
    const velocities = new ComponentStore<KinematicVelocityComponent>();
    const targets = new ComponentStore<KinematicTargetComponent>();
    const silks = new ComponentStore<SilkComponent>();
    const healths = new ComponentStore<HealthComponent>();
    const inputs = new ComponentStore<InputIntentComponent>();
    const weaverAIs = new ComponentStore<WeaverAIComponent>();
    const traversal = new ComponentStore<TraversalStateComponent>();
    const iframes = new ComponentStore<InvulnerabilityComponent>();
    const weaverTraversal = new ComponentStore<WeaverTraversalComponent>();

    const playerTags = new ComponentStore<PlayerTag>();
    const weaverTags = new ComponentStore<WeaverTag>();
    const refs = new EntityRefs(playerTags, weaverTags);

    const renderSystem = new RenderSystem(canvas);
    const cameraSystem = new CameraSystem(renderSystem, broker);
    const spawner = new EntitySpawnerSystem(
      refs,
      entities,
      transforms,
      velocities,
      targets,
      silks,
      healths,
      inputs,
      weaverAIs,
      playerTags,
      weaverTags,
      renderSystem,
      traversal,
      iframes,
      weaverTraversal
    );
    const physicsSystem = new HavokPhysicsSystem(
      commands,
      refs,
      transforms,
      velocities,
      targets,
      silks,
      renderSystem
    );
    const inputSystem = new PlayerInputSystem(refs, inputs, healths);
    const weaverBrain = new WeaverBrainSystem(
      refs,
      weaverAIs,
      transforms,
      weaverTraversal,
      healths,
      broker,
      commands
    );
    const weaverTraversalSystem = new WeaverTraversalSystem(
      refs,
      velocities,
      weaverTraversal,
      transforms,
      targets,
      weaverAIs,
      healths
    );

    const playerKinematics = new PlayerKinematicsSystem(
      refs,
      silks,
      targets,
      traversal,
      transforms,
      inputs,
      broker,
      healths
    );
    const environmentCollision = new EnvironmentCollisionSystem(
      refs,
      silks,
      targets,
      healths,
      traversal,
      broker,
      transforms
    );

    const syncSystem = new TransformSyncSystem(
      refs,
      transforms,
      silks,
      traversal,
      renderSystem,
      weaverAIs,
      healths,
      velocities,
      broker
    );
    const silkVisualizer = new SilkVisualizerSystem(refs, transforms, silks, renderSystem);
    const lightingSystem = new LightingSystem(broker, renderSystem);
    const combatSystem = new CombatSystem(
      refs,
      transforms,
      healths,
      weaverAIs,
      silks,
      iframes,
      traversal,
      broker,
      commands,
      targets
    );
    const gameDirector = new GameDirectorSystem(
      broker,
      refs,
      transforms,
      healths,
      silks,
      weaverAIs,
      velocities,
      iframes,
      targets,
      traversal
    );

    const projectileSystem = new ProjectileSystem(
      broker,
      refs,
      healths,
      iframes,
      renderSystem,
      weaverAIs
    );
    const audioSystem = new AudioDirectorSystem(broker);
    const juiceSystem = new JuiceSystem(broker, refs, renderSystem);
    const hudSystem = new DomHudSystem(broker);
    const debugTelemetry = new DebugTelemetryOverlay(
      profiler,
      broker,
      entities,
      refs,
      transforms,
      silks,
      velocities
    );

    systemManager.register(spawner);
    systemManager.register(renderSystem);
    systemManager.register(physicsSystem);
    systemManager.register(inputSystem);
    systemManager.register(weaverBrain);
    systemManager.register(playerKinematics);
    systemManager.register(weaverTraversalSystem);
    systemManager.register(environmentCollision);
    systemManager.register(syncSystem);
    systemManager.register(silkVisualizer);
    systemManager.register(cameraSystem);
    systemManager.register(combatSystem);
    systemManager.register(projectileSystem);
    systemManager.register(juiceSystem);
    systemManager.register(gameDirector);
    systemManager.register(audioSystem);
    systemManager.register(lightingSystem);
    systemManager.register(hudSystem);
    systemManager.register(debugTelemetry);

    const clock = new PerformanceClock();
    const scheduler = new RafScheduler();

    return new Engine(canvas, broker, systemManager, clock, scheduler);
  }
}
