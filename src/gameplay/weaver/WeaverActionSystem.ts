import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { WeaverAIComponent, KinematicVelocityComponent } from "../../core/ecs/Components";
import { GameEvent } from "../../core/events/GameEvents";

export class WeaverActionSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;

  constructor(private context: SystemContext) {}

  public update(dt: number): void {
    void dt;
    const aiStore = this.context.stores.get<WeaverAIComponent>("weaverAI");
    const velocityStore = this.context.stores.get<KinematicVelocityComponent>("velocity");

    const wId = this.context.refs.weaver;
    const ai = aiStore.get(wId);
    const vel = velocityStore.get(wId);

    if (!ai || !vel) return;

    // 1. Process movement intents
    vel.x = ai.desiredVelocityX;
    vel.y = ai.desiredVelocityY;

    // 2. Process shooting intents
    if (
      ai.shootRequested &&
      ai.shootOriginX !== undefined &&
      ai.shootOriginY !== undefined &&
      ai.shootTargetX !== undefined &&
      ai.shootTargetY !== undefined
    ) {
      this.context.broker.publish(GameEvent.WEAVER_SHOOT, {
        x: ai.shootOriginX,
        y: ai.shootOriginY,
        tx: ai.shootTargetX,
        ty: ai.shootTargetY,
        isRelease: ai.shootIsRelease
      });
      ai.shootRequested = false;
    }

    // 3. Process screen shake intents
    if (ai.shakeRequested && ai.shakeAmplitude !== undefined && ai.shakeDuration !== undefined) {
      this.context.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
        amplitude: ai.shakeAmplitude,
        duration: ai.shakeDuration
      });
      ai.shakeRequested = false;
    }
  }
}
