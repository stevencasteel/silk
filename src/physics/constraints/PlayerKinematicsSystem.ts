import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TetherComponent, KinematicVelocityComponent, KinematicTargetComponent, TraversalStateComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";

export class PlayerKinematicsSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;
  private gravity = -25.0;
  private wallSlideGravity = -4.0;
  private maxFallSpeed = -40.0;

  constructor(
    private refs: EntityRefs,
    private tethers: ComponentStore<TetherComponent>,
    private velocities: ComponentStore<KinematicVelocityComponent>,
    private targets: ComponentStore<KinematicTargetComponent>,
    private traversal: ComponentStore<TraversalStateComponent>
  ) {}

  public update(dt: number): void {
    const tether = this.tethers.get(this.refs.player);
    const vel = this.velocities.get(this.refs.player);
    const target = this.targets.get(this.refs.player);
    const trav = this.traversal.get(this.refs.player);
    if (!tether || !vel || !target || !trav) return;

    let nextX = target.x;
    let nextY = target.y;

    if (tether.isAttached) {
      tether.dynamicVelY += this.gravity * dt;

      const dx = nextX - tether.anchorX;
      const dy = nextY - tether.anchorY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      const tx = -ny;
      const ty = nx;

      const inputForceMag = vel.x * 2.5; 
      tether.dynamicVelX += tx * inputForceMag * dt;
      tether.dynamicVelY += ty * inputForceMag * dt;
      
      tether.dynamicVelX *= Math.pow(0.985, dt * 60);
      tether.dynamicVelY *= Math.pow(0.985, dt * 60);

      if (tether.dynamicVelY < this.maxFallSpeed) tether.dynamicVelY = this.maxFallSpeed;

      nextX += tether.dynamicVelX * dt;
      nextY += tether.dynamicVelY * dt;

      const nextDx = nextX - tether.anchorX;
      const nextDy = nextY - tether.anchorY;
      const nextDist = Math.sqrt(nextDx * nextDx + nextDy * nextDy) || 1;

      if (nextDist > tether.maxLength) {
        const nextNx = nextDx / nextDist;
        const nextNy = nextDy / nextDist;
        nextX = tether.anchorX + nextNx * tether.maxLength;
        nextY = tether.anchorY + nextNy * tether.maxLength;

        const dot = tether.dynamicVelX * nextNx + tether.dynamicVelY * nextNy;
        if (dot > 0) {
          tether.dynamicVelX -= dot * nextNx;
          tether.dynamicVelY -= dot * nextNy;
        }
        tether.tension = 1.0;
      } else {
        tether.tension = Math.max(0, nextDist / tether.maxLength);
      }
      tether.currentLength = nextDist;
      trav.state = "AIRBORNE";
      trav.charge = Math.max(0.0, trav.charge - dt * 2.0);
    } else {
      let currentGravity = this.gravity;
      let isWallSliding = false;
      let wallNormalX = 0;

      const pHalfW = 0.4;
      if (nextX <= -15.0 + pHalfW + 0.05) {
        if (tether.dynamicVelY < 0) {
          isWallSliding = true;
          wallNormalX = 1;
        }
      } else if (nextX >= 15.0 - pHalfW - 0.05) {
        if (tether.dynamicVelY < 0) {
          isWallSliding = true;
          wallNormalX = -1;
        }
      }

      if (isWallSliding) {
        currentGravity = this.wallSlideGravity;
        trav.state = "WALL_SLIDING";
        trav.wallNormalX = wallNormalX;
        tether.dynamicVelX = 0;
        trav.charge = Math.min(1.0, trav.charge + dt * 1.5);
      } else {
        trav.state = "AIRBORNE";
        trav.wallNormalX = 0;
        tether.dynamicVelX += vel.x * dt;
        tether.dynamicVelX *= Math.pow(0.95, dt * 60);
        trav.charge = Math.max(0.0, trav.charge - dt * 2.0);
      }

      tether.dynamicVelY += currentGravity * dt;
      if (tether.dynamicVelY < this.maxFallSpeed) tether.dynamicVelY = this.maxFallSpeed;

      nextX += tether.dynamicVelX * dt;
      nextY += tether.dynamicVelY * dt;
      
      tether.currentLength = 0;
      tether.tension = 0;
    }

    target.x = nextX;
    target.y = nextY;
  }
}
