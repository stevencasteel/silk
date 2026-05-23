import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TetherComponent, KinematicTargetComponent, HealthComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";

export class EnvironmentCollisionSystem implements ISystem {
  readonly phase = SystemPhase.Collision;
  private borderLimitX = 14.6; // Inner edge boundary limit
  private minY = 1.0;
  private maxY = 27.5;
  
  private wallDragSpeed = -10.0; // Steady downward sliding speed
  private currentStrain = 0.0;
  private strainBreakThreshold = 1.8;

  constructor(
    private refs: EntityRefs,
    private tethers: ComponentStore<TetherComponent>,
    private targets: ComponentStore<KinematicTargetComponent>,
    private healths: ComponentStore<HealthComponent>,
    private broker: EventBroker
  ) {}

  public update(dt: number): void {
    const tether = this.tethers.get(this.refs.player);
    const target = this.targets.get(this.refs.player);
    const health = this.healths.get(this.refs.player);
    if (!tether || !target || !health) return;

    let nextX = target.x;
    let nextY = target.y;
    const playerHalfWidth = 0.4;
    const playerHalfHeight = 0.9;

    let isSlidingOnWall = false;

    // Slide locking: Freeze horizontal boundary to eliminate bouncing
    if (nextX - playerHalfWidth <= -this.borderLimitX) {
      nextX = -this.borderLimitX + playerHalfWidth;
      isSlidingOnWall = true;
    } else if (nextX + playerHalfWidth >= this.borderLimitX) {
      nextX = this.borderLimitX - playerHalfWidth;
      isSlidingOnWall = true;
    }

    if (nextY - playerHalfHeight <= this.minY) {
      nextY = this.minY + playerHalfHeight;
      tether.dynamicVelY = 0;
    } else if (nextY + playerHalfHeight >= this.maxY) {
      nextY = this.maxY - playerHalfHeight;
      tether.dynamicVelY = 0;
    }

    // Apply sliding friction and dynamic elongation
    if (isSlidingOnWall) {
      tether.dynamicVelX = 0;
      tether.dynamicVelY = this.wallDragSpeed;
      nextY += this.wallDragSpeed * dt;

      // Dynamically stretch maxLength as the wall drags the player down
      const currentDistance = Math.sqrt((nextX - tether.anchorX) ** 2 + (nextY - tether.anchorY) ** 2);
      if (currentDistance > tether.maxLength) {
        tether.maxLength = currentDistance; // Stretch the silk string!
      }
    }

    const dx = nextX - tether.anchorX;
    const dy = nextY - tether.anchorY;
    const finalDistance = Math.sqrt(dx * dx + dy * dy) || 1.0;

    // Tension metrics scale only during stretching elongation on the walls
    if (finalDistance > 10.0) {
      tether.tension = Math.max(0.0, (finalDistance - 10.0) / 4.0); // 10.0 is base length

      if (tether.tension > 0.8) {
        this.currentStrain += dt;
        if (Math.random() < 0.2) {
          this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.12, duration: 0.1 });
        }

        if (this.currentStrain >= this.strainBreakThreshold) {
          tether.isAttached = false;
          tether.tension = 0.0;
          this.currentStrain = 0.0;
          
          health.current = 0;
          this.broker.publish(GameEvent.PLAYER_DAMAGED, { amount: 5, source: "TETHER_SNAP" });
          this.broker.publish(GameEvent.PLAYER_HEALTH_CHANGED, { hp: 0, maxHp: health.max });
          this.broker.publish(GameEvent.PLAYER_DIED, undefined);
          this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.8, duration: 0.5 });
        }
      } else {
        this.currentStrain = Math.max(0.0, this.currentStrain - dt * 2.0);
      }
    } else {
      tether.tension = 0.0;
      this.currentStrain = Math.max(0.0, this.currentStrain - dt * 2.0);
    }

    target.x = nextX;
    target.y = nextY;
  }
}
