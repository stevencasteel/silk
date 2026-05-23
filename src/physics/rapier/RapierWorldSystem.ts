import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { IReadablePhysics, PhysicsTransform } from "../../contracts/IPhysicsWorld";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { CommandBus } from "../../core/commands/CommandBus";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent, KinematicVelocityComponent, KinematicTargetComponent, SilkComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EntityId } from "../../core/ecs/Entity";
import { SetKinematicVelocityCommand, ApplyImpulseCommand, SetSilkMaxLengthCommand, SetSilkAttachedCommand } from "../commands/PhysicsCommands";
import { PLATFORM_AABBS, BORDER_AABBS } from "../collisions/EnvironmentColliders";
import type { World, RigidBody } from "@dimforge/rapier3d-compat";

export class RapierWorldSystem implements ISystem, IReadablePhysics {
  readonly phase = SystemPhase.PhysicsStep;
  readonly initPhase = InitPhase.Bootstrap;
  
  private RAPIER: typeof import("@dimforge/rapier3d-compat") | null = null;
  private world: World | null = null;
  private rigidBodies = new Map<EntityId, RigidBody>();
  private deferSetUpDone = false;

  constructor(
    private broker: EventBroker,
    private commands: CommandBus,
    private refs: EntityRefs,
    private transforms: ComponentStore<TransformComponent>,
    private velocities: ComponentStore<KinematicVelocityComponent>,
    private targets: ComponentStore<KinematicTargetComponent>,
    private silks: ComponentStore<SilkComponent>
  ) {}

  public async init(): Promise<void> {
    this.registerCommands();
    try {
      this.RAPIER = await import("@dimforge/rapier3d-compat");
      if (this.RAPIER && typeof this.RAPIER.init === "function") {
        await this.RAPIER.init();
      }
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
    } catch (err) {
      console.warn("WASM physics failed to initialize, running fallback virtual physics engine.", err);
    }
  }

  private deferSetUpRigidBodies(): void {
    if (!this.world || !this.RAPIER) return;
    
    const playerEntity = this.refs.player;
    const spiderEntity = this.refs.spider;

    if (playerEntity !== -1 && !this.rigidBodies.has(playerEntity)) {
      const pBody = this.world.createRigidBody(this.RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 16, 0));
      this.rigidBodies.set(playerEntity, pBody);
      this.world.createCollider(this.RAPIER.ColliderDesc.cuboid(0.4, 0.9, 0.4), pBody);
    }

    if (spiderEntity !== -1 && !this.rigidBodies.has(spiderEntity)) {
      const sBody = this.world.createRigidBody(this.RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 26, 0));
      this.rigidBodies.set(spiderEntity, sBody);
      this.world.createCollider(this.RAPIER.ColliderDesc.cuboid(2.0, 2.0, 2.0), sBody); 
    }

    this.deferSetUpDone = true;
  }

  private registerCommands(): void {
    this.commands.register<SetKinematicVelocityCommand>("SET_KINEMATIC_VELOCITY", (cmd) => {
      const vel = this.velocities.get(cmd.entityId);
      if (vel) { vel.x = cmd.x; vel.y = cmd.y; vel.z = cmd.z; }
    });

    this.commands.register<ApplyImpulseCommand>("APPLY_IMPULSE", (cmd) => {
      if (cmd.entityId === this.refs.player) {
        const silk = this.silks.get(this.refs.player);
        if (silk) { silk.dynamicVelX += cmd.x; silk.dynamicVelY += cmd.y; }
      }
    });

    this.commands.register<SetSilkMaxLengthCommand>("SET_SILK_MAX_LENGTH", (cmd) => {
      const silk = this.silks.get(this.refs.player);
      if (silk) silk.maxLength = cmd.length;
    });

    this.commands.register<SetSilkAttachedCommand>("SET_SILK_ATTACHED", (cmd) => {
      const silk = this.silks.get(this.refs.player);
      if (silk) silk.isAttached = cmd.attached;
    });
  }

  public update(_dt: number): void {
    void _dt;
    if (!this.deferSetUpDone) {
      this.deferSetUpRigidBodies();
    }

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

    const sTarget = this.targets.get(this.refs.spider);
    const sBody = this.rigidBodies.get(this.refs.spider);
    if (sTarget && sTarget.active && sBody) {
      sBody.setNextKinematicTranslation({ x: sTarget.x, y: sTarget.y, z: sTarget.z });
    }

    if (this.world) {
      this.world.step();
    }

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
      const sTrans = this.transforms.get(this.refs.spider);
      const sTargetFallback = this.targets.get(this.refs.spider);
      if (sTrans && sTargetFallback) { sTrans.x = sTargetFallback.x; sTrans.y = sTargetFallback.y; }
    }

    const silk = this.silks.get(this.refs.player);
    if (silk) {
      this.broker.publish(GameEvent.SILK_TENSION_CHANGE, { tension: silk.tension });
      this.broker.publish(GameEvent.SILK_LENGTH_CHANGE, { length: silk.currentLength, maxLength: silk.maxLength });
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
