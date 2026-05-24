import { Engine } from "../core/engine/Engine";
import { EventBroker } from "../core/events/EventBroker";
import { SystemManager } from "../core/systems/SystemManager";
import { CommandBus } from "../core/commands/CommandBus";
import { EcsWorld } from "../core/ecs/EcsWorld";
import { ComponentStore } from "../core/ecs/ComponentStore";
import { EntityRefs } from "../core/ecs/EntityRefs";
import {
  TransformComponent,
  KinematicVelocityComponent,
  KinematicTargetComponent,
  TetherComponent,
  HealthComponent,
  InputIntentComponent,
  WeaverAIComponent,
  PlayerTag,
  WeaverTag,
  TraversalStateComponent,
  InvulnerabilityComponent,
  WeaverTraversalComponent
} from "../core/ecs/Components";
import { RenderSystem } from "../visual/scene/RenderSystem";
import { VisualRegistry } from "../visual/scene/VisualRegistry";
import { CameraSystem } from "../visual/cameras/CameraSystem";
import { LightingSystem } from "../visual/lighting/LightingSystem";
import { AudioDirectorSystem } from "../audio/systems/AudioDirectorSystem";
import { DomHudSystem } from "../ui/hud/DomHudSystem";
import { EntitySpawnerSystem } from "../gameplay/EntitySpawnerSystem";
import { PlayerInputSystem } from "../gameplay/player/PlayerInputSystem";
import { WeaverBrainSystem } from "../gameplay/weaver/WeaverBrainSystem";
import { WeaverTraversalSystem } from "../gameplay/weaver/WeaverTraversalSystem";
import { TetherVisualizerSystem } from "../gameplay/juice/TetherVisualizerSystem";
import { PlayerKinematicsSystem } from "../gameplay/player/PlayerKinematicsSystem";
import { PlayerAnimationSystem } from "../gameplay/player/PlayerAnimationSystem";
import { EnvironmentCollisionSystem } from "../gameplay/player/EnvironmentCollisionSystem";
import { HavokPhysicsSystem } from "../physics/havok/HavokPhysicsSystem";
import { RenderInterpolationSystem } from "../visual/systems/RenderInterpolationSystem";
import { VisualStateDressingSystem } from "../visual/systems/VisualStateDressingSystem";
import { CombatSystem } from "../gameplay/combat/CombatSystem";
import { GameDirectorSystem } from "../gameplay/combat/GameDirectorSystem";
import { ProjectileSystem } from "../gameplay/combat/ProjectileSystem";
import { JuiceSystem } from "../gameplay/juice/JuiceSystem";
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

    const world = new EcsWorld();
    const transforms = new ComponentStore<TransformComponent>();
    const velocities = new ComponentStore<KinematicVelocityComponent>();
    const targets = new ComponentStore<KinematicTargetComponent>();
    const tethers = new ComponentStore<TetherComponent>();
    const healths = new ComponentStore<HealthComponent>();
    const inputs = new ComponentStore<InputIntentComponent>();
    const weaverAIs = new ComponentStore<WeaverAIComponent>();
    const traversal = new ComponentStore<TraversalStateComponent>();
    const iframes = new ComponentStore<InvulnerabilityComponent>();
    const weaverTraversal = new ComponentStore<WeaverTraversalComponent>();

    const playerTags = new ComponentStore<PlayerTag>();
    const weaverTags = new ComponentStore<WeaverTag>();
    const refs = new EntityRefs(playerTags, weaverTags);

    world.registerStore(transforms);
    world.registerStore(velocities);
    world.registerStore(targets);
    world.registerStore(tethers);
    world.registerStore(healths);
    world.registerStore(inputs);
    world.registerStore(weaverAIs);
    world.registerStore(traversal);
    world.registerStore(iframes);
    world.registerStore(weaverTraversal);
    world.registerStore(playerTags);
    world.registerStore(weaverTags);

    const visualRegistry = new VisualRegistry();
    const renderSystem = new RenderSystem(canvas, visualRegistry);
    const cameraSystem = new CameraSystem(visualRegistry, broker);
    const lightingSystem = new LightingSystem(broker, visualRegistry);
    const tetherVisualizer = new TetherVisualizerSystem(refs, transforms, tethers, visualRegistry);
    const juiceSystem = new JuiceSystem(broker, refs, visualRegistry);
    const audioSystem = new AudioDirectorSystem(broker);

    const physicsSystem = new HavokPhysicsSystem(
      commands,
      refs,
      transforms,
      velocities,
      targets,
      visualRegistry
    );
    
    const playerKinematics = new PlayerKinematicsSystem(
      refs,
      tethers,
      targets,
      traversal,
      transforms,
      inputs,
      broker,
      healths,
      commands
    );

    const playerAnimation = new PlayerAnimationSystem(
      refs,
      transforms,
      tethers,
      traversal,
      targets
    );

    const environmentCollision = new EnvironmentCollisionSystem(
      refs,
      tethers,
      targets,
      healths,
      traversal,
      broker,
      transforms
    );

    const interpolationSystem = new RenderInterpolationSystem(
      refs,
      transforms,
      visualRegistry,
      weaverAIs,
      healths,
      velocities,
      broker
    );

    const dressingSystem = new VisualStateDressingSystem(
      refs,
      tethers,
      traversal,
      visualRegistry,
      weaverAIs
    );

    const inputSystem = new PlayerInputSystem(refs, inputs, healths);
    
    const spawner = new EntitySpawnerSystem(
      refs,
      world,
      transforms,
      velocities,
      targets,
      tethers,
      healths,
      inputs,
      weaverAIs,
      playerTags,
      weaverTags,
      visualRegistry,
      traversal,
      iframes,
      weaverTraversal
    );

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

    const combatSystem = new CombatSystem(
      refs,
      transforms,
      healths,
      weaverAIs,
      tethers,
      iframes,
      traversal,
      broker,
      commands,
      targets
    );

    const gameDirector = new GameDirectorSystem(
      broker,
      refs,
      healths,
      tethers,
      spawner
    );

    const projectileSystem = new ProjectileSystem(
      broker,
      refs,
      healths,
      iframes,
      visualRegistry,
      weaverAIs
    );

    const hudSystem = new DomHudSystem(broker);
    
    const debugTelemetry = new DebugTelemetryOverlay(
      profiler,
      broker,
      world,
      refs,
      transforms,
      tethers,
      velocities
    );

    systemManager.register(spawner);
    systemManager.register(renderSystem);
    systemManager.register(physicsSystem);
    systemManager.register(inputSystem);
    systemManager.register(weaverBrain);
    systemManager.register(playerKinematics);
    systemManager.register(playerAnimation);
    systemManager.register(weaverTraversalSystem);
    systemManager.register(environmentCollision);
    systemManager.register(interpolationSystem);
    systemManager.register(dressingSystem);
    systemManager.register(tetherVisualizer);
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
