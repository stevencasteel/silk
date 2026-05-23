import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { IReadablePhysics, PhysicsTransform } from "../../contracts/IPhysicsWorld";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { CommandBus } from "../../core/commands/CommandBus";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent, KinematicVelocityComponent, KinematicTargetComponent, TetherComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EntityId } from "../../core/ecs/Entity";
import { SetKinematicVelocityCommand, ApplyImpulseCommand, SetRopeMaxLengthCommand, SetRopeAttachedCommand } from "../commands/PhysicsCommands";
import { PLATFORM_AABBS, BORDER_AABBS } from "../collisions/EnvironmentColliders";
import type { World, RigidBody } from "@dimforge/rapier3d-compat";

export class RapierWorldSystem implements ISystem, IReadablePhysics {
  readonly phase = SystemPhase.PhysicsStep;
  readonly initPhase = InitPhase.Bootstrap;
  
  private RAPIER: typeof import("@dimforge/rapier3d-compat") | null = null;
  private world: World | null = null;
  private rigidBodies = new Map<EntityId, RigidBody>();

  constructor(
    private broker: EventBroker,
    private commands: CommandBus,
    private refs: EntityRefs,
    private transforms: ComponentStore<TransformComponent>,
    private velocities: ComponentStore<KinematicVelocityComponent>,
    private targets: ComponentStore<KinematicTargetComponent>,
    private tethers: ComponentStore<TetherComponent>
  ) {}

  public async init(): Promise<void> {
    this.registerCommands();
    try {
      this.RAPIER = await import("@dimforge/rapier3d-compat");
      if (this.RAPIER && typeof this.RAPIER.init === "function") await this.RAPIER.init();
      
      this.world = new this.RAPIER.World({ x: 0, y: -9.81, z: 0 });

      const allAabbs = [...PLATFORM_AABBS, ...BORDER_AABBS];
      for (const aabb of allAabbs) {
        const hx = (aabb.maxX - aabb.minX) / 2;
        const hy = (aabb.maxY - aabb.minY) / 2;
        const hz = (aabb.maxZ - aabb.minZ) / 2;
        const cx = aabb.minX + hx;
        const cy = aabb.minY + hy;
        const cz = aabb.minZ + hz;
        
        const body = this.world.createRigidBody(
          this.RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, cz)
        );
        this.world.createCollider(
          this.RAPIER.ColliderDesc.cuboid(hx, hy, hz),
          body
        );
      }

      const pBody = this.world.createRigidBody(this.RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 10, 0));
      this.rigidBodies.set(this.refs.player, pBody);
      this.world.createCollider(this.RAPIER.ColliderDesc.cuboid(0.4, 0.9, 0.4), pBody);

      const wBody = this.world.createRigidBody(this.RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(5, 5, 0));
      this.rigidBodies.set(this.refs.warden, wBody);
      this.world.createCollider(this.RAPIER.ColliderDesc.cuboid(1.0, 1.0, 1.0), wBody);

    } catch (err) {
      console.warn("Failed to initialize Rapier WASM, running fallback virtual physics engine.", err);
    }
  }

  private registerCommands(): void {
    this.commands.register<SetKinematicVelocityCommand>("SET_KINEMATIC_VELOCITY", (cmd) => {
      const vel = this.velocities.get(cmd.entityId);
      if (vel) { vel.x = cmd.x; vel.y = cmd.y; vel.z = cmd.z; }
    });

    this.commands.register<ApplyImpulseCommand>("APPLY_IMPULSE", (cmd) => {
      if (cmd.entityId === this.refs.player) {
        const tether = this.tethers.get(this.refs.player);
        if (tether) { tether.dynamicVelX += cmd.x; tether.dynamicVelY += cmd.y; }
      } else if (this.world) {
        const body = this.rigidBodies.get(cmd.entityId);
        if (body && typeof body.applyImpulse === "function") body.applyImpulse({ x: cmd.x, y: cmd.y, z: cmd.z }, true);
      }
    });

    this.commands.register<SetRopeMaxLengthCommand>("SET_ROPE_MAX_LENGTH", (cmd) => {
      const tether = this.tethers.get(this.refs.player);
      if (tether) tether.maxLength = cmd.length;
    });

    this.commands.register<SetRopeAttachedCommand>("SET_ROPE_ATTACHED", (cmd) => {
      const tether = this.tethers.get(this.refs.player);
      if (tether) tether.isAttached = cmd.attached;
    });
  }

  public update(_dt: number): void {
    void _dt;
    this.commands.flush();

    for (const [, curr] of this.transforms.entries()) {
      curr.prevX = curr.x; curr.prevY = curr.y; curr.prevZ = curr.z;
      curr.prevQx = curr.qx; curr.prevQy = curr.qy; curr.prevQz = curr.qz; curr.prevQw = curr.qw;
    }

    const pTarget = this.targets.get(this.refs.player);
    const pBody = this.rigidBodies.get(this.refs.player);
    if (pTarget && pTarget.active && pBody) {
      pBody.setNextKinematicTranslation({ x: pTarget.x, y: pTarget.y, z: pTarget.z });
    }

    const wTarget = this.targets.get(this.refs.warden);
    const wBody = this.rigidBodies.get(this.refs.warden);
    if (wTarget && wTarget.active && wBody) {
      wBody.setNextKinematicTranslation({ x: wTarget.x, y: wTarget.y, z: wTarget.z });
    }

    if (this.world) this.world.step();

    for (const [id, body] of this.rigidBodies.entries()) {
      const t = body.translation();
      const r = body.rotation();
      const curr = this.transforms.get(id);
      if (curr) {
        curr.x = t.x; curr.y = t.y; curr.z = t.z;
        curr.qx = r.x; curr.qy = r.y; curr.qz = r.z; curr.qw = r.w;
      }
    }

    if (!this.world) {
      const pTrans = this.transforms.get(this.refs.player);
      if (pTrans && pTarget) { pTrans.x = pTarget.x; pTrans.y = pTarget.y; }
      const wTrans = this.transforms.get(this.refs.warden);
      const wTargetFallback = this.targets.get(this.refs.warden);
      if (wTrans && wTargetFallback) { wTrans.x = wTargetFallback.x; wTrans.y = wTargetFallback.y; }
    }

    const tether = this.tethers.get(this.refs.player);
    if (tether) {
      this.broker.publish(GameEvent.ROPE_TENSION_CHANGE, { tension: tether.tension });
      this.broker.publish(GameEvent.ROPE_LENGTH_CHANGE, { length: tether.currentLength, maxLength: tether.maxLength });
    }
  }

  public getTransform(id: EntityId): PhysicsTransform | null {
    const t = this.transforms.get(id);
    return t ? { x: t.x, y: t.y, z: t.z, qx: t.qx, qy: t.qy, qz: t.qz, qw: t.qw } : null;
  }

  public getPreviousTransform(id: EntityId): PhysicsTransform | null {
    const t = this.transforms.get(id);
    return t ? { x: t.prevX, y: t.prevY, z: t.prevZ, qx: t.prevQx, qy: t.prevQy, qz: t.prevQz, qw: t.prevQw } : null;
  }
}
