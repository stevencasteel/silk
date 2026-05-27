import { Engine } from "../core/engine/Engine";
import { EventBroker } from "../core/events/EventBroker";
import { SystemManager } from "../core/systems/SystemManager";
import { CommandBus } from "../core/commands/CommandBus";
import { EcsWorld } from "../core/ecs/EcsWorld";
import { ComponentStore } from "../core/ecs/ComponentStore";
import { EntityRefs } from "../core/ecs/EntityRefs";
import { StoreContainer } from "../core/ecs/StoreContainer";
import { SystemContext } from "../core/engine/SystemContext";
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
import { HudSyncSystem } from "../ui/hud/HudSyncSystem";
import { EntitySpawnerSystem } from "../gameplay/EntitySpawnerSystem";
import { PlayerInputSystem } from "../gameplay/player/PlayerInputSystem";
import { WeaverBrainSystem } from "../gameplay/weaver/WeaverBrainSystem";
import { WeaverTraversalSystem } from "../gameplay/weaver/WeaverTraversalSystem";
import { TetherVisualizerSystem } from "../gameplay/juice/TetherVisualizerSystem";
import { PlayerKinematicsSystem } from "../gameplay/player/PlayerKinematicsSystem";
import { PlayerAnimationSystem } from "../gameplay/player/PlayerAnimationSystem";
import { VerticalBoundarySystem } from "../gameplay/player/VerticalBoundarySystem";
import { HavokPhysicsSystem } from "../physics/havok/HavokPhysicsSystem";
import { ParallaxScrollSystem } from "../visual/systems/ParallaxScrollSystem";
import { EntityInterpolationSystem } from "../visual/systems/EntityInterpolationSystem";
import { VisualStateDressingSystem } from "../visual/systems/VisualStateDressingSystem";
import { CombatSystem } from "../gameplay/combat/CombatSystem";
import { HealthSystem } from "../gameplay/combat/HealthSystem";
import { GameDirectorSystem } from "../gameplay/combat/GameDirectorSystem";
import { ProjectileSystem } from "../gameplay/combat/ProjectileSystem";
import { JuiceSystem } from "../gameplay/juice/JuiceSystem";
import { WeaverShatterSystem } from "../gameplay/juice/WeaverShatterSystem";
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

    const storeContainer = new StoreContainer();
    storeContainer.register("transform", transforms);
    storeContainer.register("velocity", velocities);
    storeContainer.register("target", targets);
    storeContainer.register("tether", tethers);
    storeContainer.register("health", healths);
    storeContainer.register("input", inputs);
    storeContainer.register("weaverAI", weaverAIs);
    storeContainer.register("traversal", traversal);
    storeContainer.register("iframe", iframes);
    storeContainer.register("weaverTraversal", weaverTraversal);
    storeContainer.register("playerTag", playerTags);
    storeContainer.register("weaverTag", weaverTags);

    const visualRegistry = new VisualRegistry();

    const context = new SystemContext(
      world,
      broker,
      commands,
      refs,
      visualRegistry,
      storeContainer
    );

    const renderSystem = new RenderSystem(canvas, visualRegistry, broker);
    const cameraSystem = new CameraSystem(visualRegistry, broker);
    const lightingSystem = new LightingSystem(broker, visualRegistry);
    const tetherVisualizer = new TetherVisualizerSystem(context);
    const juiceSystem = new JuiceSystem(context);
    const shatterSystem = new WeaverShatterSystem(context);
    const audioSystem = new AudioDirectorSystem(context);

    const physicsSystem = new HavokPhysicsSystem(context);

    const playerKinematics = new PlayerKinematicsSystem(context);
    const playerAnimation = new PlayerAnimationSystem(context);
    const environmentCollision = new VerticalBoundarySystem(context);

    const parallaxScroll = new ParallaxScrollSystem(context);
    const interpolationSystem = new EntityInterpolationSystem(context);

    const dressingSystem = new VisualStateDressingSystem(context);
    const inputSystem = new PlayerInputSystem(context);
    const spawner = new EntitySpawnerSystem(context);

    const weaverBrain = new WeaverBrainSystem(context);
    const weaverTraversalSystem = new WeaverTraversalSystem(context);

    const combatSystem = new CombatSystem(context);
    const healthSystem = new HealthSystem(context);
    const projectileSystem = new ProjectileSystem(context);
    const gameDirector = new GameDirectorSystem(context, spawner);

    const hudSystem = new HudSyncSystem(broker);

    const debugTelemetry = new DebugTelemetryOverlay(profiler, context);

    systemManager.register(spawner);
    systemManager.register(renderSystem);
    systemManager.register(physicsSystem);
    systemManager.register(inputSystem);
    systemManager.register(weaverBrain);
    systemManager.register(playerKinematics);
    systemManager.register(playerAnimation);
    systemManager.register(weaverTraversalSystem);
    systemManager.register(environmentCollision);
    systemManager.register(parallaxScroll);
    systemManager.register(interpolationSystem);
    systemManager.register(dressingSystem);
    systemManager.register(tetherVisualizer);
    systemManager.register(cameraSystem);
    systemManager.register(combatSystem);
    systemManager.register(healthSystem);
    systemManager.register(projectileSystem);
    systemManager.register(juiceSystem);
    systemManager.register(shatterSystem);
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
