import { Engine } from "../core/engine/Engine";
import { EventBroker } from "../core/events/EventBroker";
import { SystemManager } from "../core/systems/SystemManager";
import { CommandBus } from "../core/commands/CommandBus";
import { EntityRegistry } from "../core/ecs/Entity";
import { ComponentStore } from "../core/ecs/ComponentStore";
import { EntityRefs } from "../core/ecs/EntityRefs";
import { TransformComponent, KinematicVelocityComponent, KinematicTargetComponent, SilkComponent, HealthComponent, InputIntentComponent, SpiderAIComponent, PlayerStatsComponent, PlayerTag, SpiderTag, AnchorTag, TraversalStateComponent, InvulnerabilityComponent, SpiderTraversalComponent } from "../core/ecs/Components";
import { RenderSystem } from "../babylon/scene/RenderSystem";
import { CameraSystem } from "../babylon/cameras/CameraSystem";
import { LightingSystem } from "../babylon/lighting/LightingSystem";
import { AudioDirectorSystem } from "../audio/systems/AudioDirectorSystem";
import { DomHudSystem } from "../ui/hud/DomHudSystem";
import { EntitySpawnerSystem } from "../gameplay/systems/EntitySpawnerSystem";
import { PlayerInputSystem } from "../gameplay/systems/PlayerInputSystem";
import { PlayerMovementSystem } from "../gameplay/systems/PlayerMovementSystem";
import { SpiderBrainSystem } from "../gameplay/systems/SpiderBrainSystem";
import { SpiderTraversalSystem } from "../gameplay/systems/SpiderTraversalSystem";
import { SilkVisualizerSystem } from "../gameplay/systems/SilkVisualizerSystem";
import { PlayerKinematicsSystem } from "../physics/constraints/PlayerKinematicsSystem";
import { EnvironmentCollisionSystem } from "../physics/collisions/EnvironmentCollisionSystem";
import { RapierWorldSystem } from "../physics/rapier/RapierWorldSystem";
import { TransformSyncSystem } from "../physics/sync/TransformSyncSystem";
import { CombatSystem } from "../gameplay/systems/CombatSystem";
import { GameDirectorSystem } from "../gameplay/systems/GameDirectorSystem";
import { JuiceSystem } from "../babylon/particles/JuiceSystem";
import { Profiler } from "../core/diagnostics/Profiler";
import { DebugWireframeSystem } from "../core/diagnostics/DebugWireframeSystem";
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
        const spiderAIs = new ComponentStore<SpiderAIComponent>();
        const playerStats = new ComponentStore<PlayerStatsComponent>();
        const traversal = new ComponentStore<TraversalStateComponent>();
        const iframes = new ComponentStore<InvulnerabilityComponent>();
        const spiderTraversal = new ComponentStore<SpiderTraversalComponent>();
        
        const playerTags = new ComponentStore<PlayerTag>();
        const spiderTags = new ComponentStore<SpiderTag>();
        const anchorTags = new ComponentStore<AnchorTag>();
        const refs = new EntityRefs(playerTags, spiderTags, anchorTags);

        const renderSystem = new RenderSystem(canvas);
        const cameraSystem = new CameraSystem(refs, transforms, spiderAIs, renderSystem, broker);
        const spawner = new EntitySpawnerSystem(refs, entities, transforms, velocities, targets, silks, healths, inputs, spiderAIs, playerStats, playerTags, spiderTags, anchorTags, renderSystem, traversal, iframes, spiderTraversal);
        const physicsSystem = new RapierWorldSystem(broker, commands, refs, transforms, velocities, targets, silks);
        const inputSystem = new PlayerInputSystem(refs, inputs);
        const movementSystem = new PlayerMovementSystem();
        const spiderBrain = new SpiderBrainSystem(refs, spiderAIs, transforms, spiderTraversal, healths, broker, commands);
        const spiderTraversalSystem = new SpiderTraversalSystem(refs, velocities, spiderTraversal, transforms, targets, spiderAIs, healths);
        
        const playerKinematics = new PlayerKinematicsSystem(refs, silks, targets, traversal, transforms, inputs, broker);
        const environmentCollision = new EnvironmentCollisionSystem(refs, silks, targets, healths, traversal, broker);
        
        const syncSystem = new TransformSyncSystem(refs, transforms, silks, traversal, renderSystem, spiderAIs, healths);
        const silkVisualizer = new SilkVisualizerSystem(refs, transforms, silks, renderSystem);
        const lightingSystem = new LightingSystem(broker, renderSystem);
        const combatSystem = new CombatSystem(refs, transforms, healths, spiderAIs, silks, iframes, traversal, broker, commands);
        const gameDirector = new GameDirectorSystem(broker, refs, transforms, healths, silks, spiderAIs, velocities, iframes, targets, traversal);
        
        const audioSystem = new AudioDirectorSystem(broker);
        const juiceSystem = new JuiceSystem(broker, renderSystem);
        const hudSystem = new DomHudSystem(broker);
        const debugWireframe = new DebugWireframeSystem(refs, transforms, silks, renderSystem);
        const debugTelemetry = new DebugTelemetryOverlay(profiler, broker, entities, refs, transforms, silks, velocities);

        systemManager.register(spawner);
        systemManager.register(renderSystem);
        systemManager.register(physicsSystem);
        systemManager.register(inputSystem);
        systemManager.register(movementSystem);
        systemManager.register(spiderBrain);
        systemManager.register(playerKinematics);
        systemManager.register(spiderTraversalSystem);
        systemManager.register(environmentCollision);
        systemManager.register(syncSystem);
        systemManager.register(silkVisualizer);
        systemManager.register(cameraSystem);
        systemManager.register(combatSystem);
        systemManager.register(juiceSystem);
        systemManager.register(gameDirector);
        systemManager.register(audioSystem);
        systemManager.register(lightingSystem);
        systemManager.register(hudSystem);
        systemManager.register(debugWireframe);
        systemManager.register(debugTelemetry);

        const clock = new PerformanceClock();
        const scheduler = new RafScheduler();

        return new Engine(canvas, broker, systemManager, clock, scheduler);
    }
}
