import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TetherComponent, KinematicTargetComponent, TraversalStateComponent, TransformComponent, InputIntentComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";

export class PlayerKinematicsSystem implements ISystem {
  readonly phase = SystemPhase.Kinematics;
  private gravity = -20.0;

  constructor(
    private refs: EntityRefs,
    private tethers: ComponentStore<TetherComponent>,
    _velocities: any,
    private targets: ComponentStore<KinematicTargetComponent>,
    private traversal: ComponentStore<TraversalStateComponent>,
    private transforms: ComponentStore<TransformComponent>,
    private inputs: ComponentStore<InputIntentComponent>
  ) {
    void _velocities;
  }

  public update(dt: number): void {
    const tether = this.tethers.get(this.refs.player);
    const target = this.targets.get(this.refs.player);
    const trav = this.traversal.get(this.refs.player);
    const wTrans = this.transforms.get(this.refs.warden);
    const input = this.inputs.get(this.refs.player);

    if (!tether || !target || !trav || !wTrans) return;

    // 1. Sync the anchor directly to the Warden's horizontal coordinate
    tether.anchorX = wTrans.x;
    tether.anchorY = wTrans.y;
    tether.anchorZ = wTrans.z;

    // 2. Direct Steering swings
    if (input) {
      const swingSteerForce = 22.0; 
      tether.dynamicVelX += input.x * swingSteerForce * dt;
    }

    // Apply continuous gravity
    tether.dynamicVelY += this.gravity * dt;

    // Apply drag damping
    tether.dynamicVelX *= Math.pow(0.985, dt * 60);
    tether.dynamicVelY *= Math.pow(0.985, dt * 60);

    let nextX = target.x + tether.dynamicVelX * dt;
    let nextY = target.y + tether.dynamicVelY * dt;

    const dx = nextX - tether.anchorX;
    const dy = nextY - tether.anchorY;
    const currentDistance = Math.sqrt(dx * dx + dy * dy) || 1.0;

    // 3. Keep player locked to pendulum constraints
    if (currentDistance > tether.maxLength) {
      const nx = dx / currentDistance;
      const ny = dy / currentDistance;

      nextX = tether.anchorX + nx * tether.maxLength;
      nextY = tether.anchorY + ny * tether.maxLength;

      const dot = tether.dynamicVelX * nx + tether.dynamicVelY * ny;
      if (dot > 0) {
        tether.dynamicVelX -= dot * nx;
        tether.dynamicVelY -= dot * ny;
      }
    }

    tether.currentLength = currentDistance;
    trav.state = "AIRBORNE";

    target.x = nextX;
    target.y = nextY;
    target.active = true;
  }
}
