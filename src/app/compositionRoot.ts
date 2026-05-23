import { Engine } from "../core/engine/Engine";
import { EventBroker } from "../core/events/EventBroker";
import { SystemManager } from "../core/systems/SystemManager";
import { CommandBus } from "../core/commands/CommandBus";
import { EntityRegistry } from "../core/ecs/Entity";
import { ComponentStore } from "../core/ecs/ComponentStore";
import { EntityRefs } from "../core/ecs/EntityRefs";
import { TransformComponent, KinematicVelocityComponent, KinematicTargetComponent, TetherComponent, HealthComponent, InputIntentComponent, WardenAIComponent, PlayerStatsComponent, PlayerTag, WardenTag, AnchorTag } from "../core/ecs/Components";

import { RenderSystem } from "../babylon/scene/RenderSystem";
import { CameraSystem } from "../babylon/cameras/CameraSystem";
import { LightingSystem } from "../babylon/lighting/LightingSystem";
import { AudioDirectorSystem } from "../audio/systems/AudioDirectorSystem";
import { DomHudSystem } from "../ui/hud/DomHudSystem";

import { EntitySpawnerSystem } from "../gameplay/systems/EntitySpawnerSystem";
import { PlayerInputSystem } from "../gameplay/systems/PlayerInputSystem";
import { PlayerMovementSystem } from "../gameplay/systems/PlayerMovementSystem";
import { WardenBrainSystem } from "../gameplay/systems/WardenBrainSystem";
import { RopeVisualizerSystem } from "../gameplay/systems/RopeVisualizerSystem";

import { PlayerKinematicsSystem } from "../physics/constraints/PlayerKinematicsSystem";
import { EnvironmentCollisionSystem } from "../physics/collisions/EnvironmentCollisionSystem";
import { RapierWorldSystem } from "../physics/rapier/RapierWorldSystem";
import { TransformSyncSystem } from "../physics/sync/TransformSyncSystem";

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
        const tethers = new ComponentStore<TetherComponent>();
        const healths = new ComponentStore<HealthComponent>();
        const inputs = new ComponentStore<InputIntentComponent>();
        const wardenAIs = new ComponentStore<WardenAIComponent>();
        const playerStats = new ComponentStore<PlayerStatsComponent>();
        const playerTags = new ComponentStore<PlayerTag>();
        const wardenTags = new ComponentStore<WardenTag>();
        const anchorTags = new ComponentStore<AnchorTag>();

        const refs = new EntityRefs(playerTags, wardenTags, anchorTags);

        const renderSystem = new RenderSystem(canvas);
        const cameraSystem = new CameraSystem(refs, transforms, renderSystem, broker);
        
        const spawner = new EntitySpawnerSystem(refs, entities, transforms, velocities, targets, tethers, healths, inputs, wardenAIs, playerStats, playerTags, wardenTags, anchorTags, renderSystem);
        const physicsSystem = new RapierWorldSystem(broker, commands, refs, transforms, velocities, targets, tethers);
        
        const inputSystem = new PlayerInputSystem(refs, inputs);
        const movementSystem = new PlayerMovementSystem(refs, inputs, playerStats, tethers, commands, broker);
        const wardenBrain = new WardenBrainSystem(refs, wardenAIs, transforms, broker, commands);
        
        const playerKinematics = new PlayerKinematicsSystem(refs, tethers, velocities, targets);
        const environmentCollision = new EnvironmentCollisionSystem(refs, tethers, targets);
        
        const syncSystem = new TransformSyncSystem(transforms, renderSystem);
        const ropeVisualizer = new RopeVisualizerSystem(refs, transforms, tethers, renderSystem);
        
        const lightingSystem = new LightingSystem(broker);
        const audioSystem = new AudioDirectorSystem(broker);
        const hudSystem = new DomHudSystem(broker);
        
        const debugWireframe = new DebugWireframeSystem(refs, transforms, tethers, renderSystem);
        const debugTelemetry = new DebugTelemetryOverlay(profiler, broker, entities);

        systemManager.register(spawner);
        systemManager.register(renderSystem);
        systemManager.register(physicsSystem);
        
        systemManager.register(inputSystem);
        systemManager.register(movementSystem);
        systemManager.register(wardenBrain);
        
        systemManager.register(playerKinematics);
        systemManager.register(environmentCollision);
        
        systemManager.register(syncSystem);
        systemManager.register(ropeVisualizer);
        systemManager.register(cameraSystem);
        
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
