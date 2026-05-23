import { Engine } from "../core/engine/Engine";
import { EventBroker } from "../core/events/EventBroker";
import { SystemManager } from "../core/systems/SystemManager";
import { PlayerInputSystem } from "../gameplay/systems/PlayerInputSystem";
import { PlayerMovementSystem } from "../gameplay/systems/PlayerMovementSystem";
import { WardenBrainSystem } from "../gameplay/systems/WardenBrainSystem";
import { PlayerData } from "../gameplay/components/PlayerData";
import { WardenData } from "../gameplay/components/WardenData";
import { RapierWorldSystem } from "../physics/rapier/RapierWorldSystem";
import { TransformSyncSystem } from "../physics/sync/TransformSyncSystem";
import { RenderSystem } from "../babylon/scene/RenderSystem";
import { CameraSystem } from "../babylon/cameras/CameraSystem";
import { LightingSystem } from "../babylon/lighting/LightingSystem";
import { AudioDirectorSystem } from "../audio/systems/AudioDirectorSystem";
import { DomHudSystem } from "../ui/hud/DomHudSystem";

export class CompositionRoot {
    public buildEngine(canvas: HTMLCanvasElement): Engine {
        const broker = new EventBroker();
        const systemManager = new SystemManager();

        const playerData = new PlayerData();
        const wardenData = new WardenData();

        const physicsSystem = new RapierWorldSystem();
        const renderSystem = new RenderSystem(canvas);
        const syncSystem = new TransformSyncSystem(physicsSystem);
        
        const inputSystem = new PlayerInputSystem();
        const movementSystem = new PlayerMovementSystem(playerData, inputSystem);
        const wardenBrain = new WardenBrainSystem(wardenData, broker);
        
        const cameraSystem = new CameraSystem();
        const lightingSystem = new LightingSystem(broker);
        const audioSystem = new AudioDirectorSystem(broker);
        const hudSystem = new DomHudSystem(broker);

        systemManager.register(inputSystem);
        systemManager.register(movementSystem);
        systemManager.register(wardenBrain);
        systemManager.register(physicsSystem);
        systemManager.register(syncSystem);
        systemManager.register(audioSystem);
        systemManager.register(cameraSystem);
        systemManager.register(renderSystem);
        systemManager.register(lightingSystem);
        systemManager.register(hudSystem);

        return new Engine(canvas, broker, systemManager);
    }
}
