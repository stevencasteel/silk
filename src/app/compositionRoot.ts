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
  WeaverTraversalComponent,
  WallBugComponent,
  StickySurfaceComponent,
  ProjectileComponent,
  WeaverSweepComponent,
  CollisionStateComponent,
  TetherStrainComponent,
  ParticleEmitterComponent,
  HitboxComponent,
  HurtboxComponent
} from "../core/ecs/Components";
import { RenderSystem } from "../visual/scene/RenderSystem";
import { KinematicIntegrationSystem } from "../physics/systems/KinematicIntegrationSystem";
import { CollisionResolutionSystem } from "../physics/systems/CollisionResolutionSystem";
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
import { WallBugSystem } from "../gameplay/player/WallBugSystem";
import { TutorialSystem } from "../gameplay/player/TutorialSystem";
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
    const wallBugs = new ComponentStore<WallBugComponent>();
    const stickySurfaces = new ComponentStore<StickySurfaceComponent>();
    const projectiles = new ComponentStore<ProjectileComponent>();
    const weaverSweep = new ComponentStore<WeaverSweepComponent>();
    const collisionStates = new ComponentStore<CollisionStateComponent>();
    const tetherStrains = new ComponentStore<TetherStrainComponent>();
    const particleEmitters = new ComponentStore<ParticleEmitterComponent>();
    const hitboxes = new ComponentStore<HitboxComponent>();
    const hurtboxes = new ComponentStore<HurtboxComponent>();

    const playerTags = new ComponentStore<PlayerTag>();
    const weaverTags = new ComponentStore<WeaverTag>();
    const refs = new EntityRefs(playerTags, weaverTags);

    const storeContainer = new StoreContainer();

    const registerStore = <T>(key: string, store: ComponentStore<T>) => {
      world.registerStore(store);
      storeContainer.register(key, store);
    };

    registerStore("transform", transforms);
    registerStore("velocity", velocities);
    registerStore("target", targets);
    registerStore("tether", tethers);
    registerStore("health", healths);
    registerStore("input", inputs);
    registerStore("weaverAI", weaverAIs);
    registerStore("traversal", traversal);
    registerStore("iframe", iframes);
    registerStore("weaverTraversal", weaverTraversal);
    registerStore("wallBug", wallBugs);
    registerStore("stickySurface", stickySurfaces);
    registerStore("projectile", projectiles);
    registerStore("weaverSweep", weaverSweep);
    registerStore("collisionState", collisionStates);
    registerStore("tetherStrain", tetherStrains);
    registerStore("particleEmitter", particleEmitters);
    registerStore("hitbox", hitboxes);
    registerStore("hurtbox", hurtboxes);
    registerStore("playerTag", playerTags);
    registerStore("weaverTag", weaverTags);

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
    const cameraSystem = new CameraSystem(context);
    const lightingSystem = new LightingSystem(context);
    const tetherVisualizer = new TetherVisualizerSystem(context);
    const juiceSystem = new JuiceSystem(context);
    const shatterSystem = new WeaverShatterSystem(context);
    const audioSystem = new AudioDirectorSystem(context);

    const physicsSystem = new HavokPhysicsSystem(context);
    const kinematicIntegrationSystem = new KinematicIntegrationSystem(context);
    const collisionResolutionSystem = new CollisionResolutionSystem(context);

    const playerKinematics = new PlayerKinematicsSystem(context);
    const playerAnimation = new PlayerAnimationSystem(context);
    const environmentCollision = new VerticalBoundarySystem(context);
    const wallBugSystem = new WallBugSystem(context);
    const tutorialSystem = new TutorialSystem(context);

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

    const hudSystem = new HudSyncSystem(context);

    const debugTelemetry = new DebugTelemetryOverlay(profiler, context);

    systemManager.register(spawner);
    systemManager.register(renderSystem);
    systemManager.register(physicsSystem);
    systemManager.register(kinematicIntegrationSystem);
    systemManager.register(collisionResolutionSystem);
    systemManager.register(inputSystem);
    systemManager.register(weaverBrain);
    systemManager.register(playerKinematics);
    systemManager.register(playerAnimation);
    systemManager.register(weaverTraversalSystem);
    systemManager.register(environmentCollision);
    systemManager.register(wallBugSystem);
    systemManager.register(tutorialSystem);
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
