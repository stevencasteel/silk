import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import { IReadablePhysics, PhysicsTransform } from "../../contracts/IPhysicsWorld";
import { CommandBus } from "../../core/commands/CommandBus";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
  TransformComponent,
  KinematicVelocityComponent,
  KinematicTargetComponent
} from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EntityId } from "../../core/ecs/Entity";
import { SetKinematicVelocityCommand } from "../commands/PhysicsCommands";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { ARENA_CONFIG, CANONICAL_UNITS } from "../../core/engine/ArenaConfig";
import * as BABYLON from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";

export class HavokPhysicsSystem implements ISystem, IReadablePhysics {
  readonly phase = SystemPhase.PhysicsStep;
  readonly initPhase = InitPhase.Bootstrap;
  private havokPlugin: BABYLON.HavokPlugin | null = null;

  constructor(
    private commands: CommandBus,
    private refs: EntityRefs,
    private transforms: ComponentStore<TransformComponent>,
    private velocities: ComponentStore<KinematicVelocityComponent>,
    private targets: ComponentStore<KinematicTargetComponent>,
    private visualRegistry: IVisualRegistry
  ) {}

  public async init(): Promise<void> {
    this.registerCommands();
    const scene = this.visualRegistry.getScene();
    if (scene) {
      try {
        let havokInstance;
        try {
          havokInstance = await HavokPhysics({
            locateFile: () => "./HavokPhysics.wasm"
          });
        } catch {
          havokInstance = await HavokPhysics({
            locateFile: () => "https://cdn.babylonjs.com/havok/HavokPhysics.wasm"
          });
        }

        this.havokPlugin = new BABYLON.HavokPlugin(true, havokInstance);
        scene.enablePhysics(new BABYLON.Vector3(0, CANONICAL_UNITS.GRAVITY.PHYSICAL_EARTH, 0), this.havokPlugin);
        console.log("[HavokPhysicsSystem] Havok initialized successfully.");

        const playHalfWidth = ARENA_CONFIG.HORIZONTAL.PLAY_AREA_HALF_WIDTH;
        const wallThickness = 1.0;
        const wallHeight = ARENA_CONFIG.VERTICAL.WALL_GEOMETRY_HEIGHT;
        const wallY = ARENA_CONFIG.VERTICAL.WALL_GEOMETRY_HEIGHT * 0.1;

        const physFloor = BABYLON.MeshBuilder.CreateBox(
          "physFloor",
          { width: playHalfWidth * 2 + 4, height: 1.0, depth: 6 },
          scene
        );
        physFloor.position.set(0, ARENA_CONFIG.VERTICAL.FLOOR_Y - 0.5, 0);
        physFloor.isVisible = false;
        new BABYLON.PhysicsAggregate(
          physFloor,
          BABYLON.PhysicsShapeType.BOX,
          { mass: 0, friction: 0.8, restitution: 0.2 },
          scene
        );

        const physLeft = BABYLON.MeshBuilder.CreateBox(
          "physLeft",
          { width: wallThickness, height: wallHeight, depth: 6 },
          scene
        );
        physLeft.position.set(-(playHalfWidth + wallThickness / 2), wallY, 0);
        physLeft.isVisible = false;
        new BABYLON.PhysicsAggregate(
          physLeft,
          BABYLON.PhysicsShapeType.BOX,
          { mass: 0, friction: 0.8 },
          scene
        );

        const physRight = BABYLON.MeshBuilder.CreateBox(
          "physRight",
          { width: wallThickness, height: wallHeight, depth: 6 },
          scene
        );
        physRight.position.set((playHalfWidth + wallThickness / 2), wallY, 0);
        physRight.isVisible = false;
        new BABYLON.PhysicsAggregate(
          physRight,
          BABYLON.PhysicsShapeType.BOX,
          { mass: 0, friction: 0.8 },
          scene
        );
      } catch (err) {
        console.warn(
          "[HavokPhysicsSystem] Failed to load Havok. Standby with visual physics fallback.",
          err
        );
      }
    }
  }

  private registerCommands(): void {
    this.commands.register<SetKinematicVelocityCommand>("SET_KINEMATIC_VELOCITY", (cmd) => {
      const vel = this.velocities.get(cmd.entityId);
      if (vel) {
        vel.x = cmd.x;
        vel.y = cmd.y;
        vel.z = cmd.z;
      }
    });
  }

  public update(): void {
    this.commands.flush();
    for (const [, curr] of this.transforms.entries()) {
      curr.prevX = curr.x;
      curr.prevY = curr.y;
      curr.prevZ = curr.z;
      curr.prevQx = curr.qx;
      curr.prevQy = curr.qy;
      curr.prevQz = curr.qz;
      curr.prevQw = curr.qw;
    }
    const pTarget = this.targets.get(this.refs.player);
    const pTrans = this.transforms.get(this.refs.player);
    if (pTrans && pTarget && pTarget.active) {
      pTrans.x = pTarget.x;
      pTrans.y = pTarget.y;
      pTrans.z = pTarget.z;
    }
    const wTarget = this.targets.get(this.refs.weaver);
    const wTrans = this.transforms.get(this.refs.weaver);
    if (wTrans && wTarget && wTarget.active) {
      wTrans.x = wTarget.x;
      wTrans.y = wTarget.y;
      wTrans.z = wTarget.z;
    }
  }

  public getTransform(id: EntityId): PhysicsTransform | null {
    const t = this.transforms.get(id);
    return t ? { x: t.x, y: t.y, z: t.z, qx: t.qx, qy: t.qy, qz: t.qz, qw: t.qw } : null;
  }

  public getPreviousTransform(id: EntityId): PhysicsTransform | null {
    const t = this.transforms.get(id);
    return t
      ? {
          x: t.prevX,
          y: t.prevY,
          z: t.prevZ,
          qx: t.prevQx,
          qy: t.prevQy,
          qz: t.prevQz,
          qw: t.prevQw
        }
      : null;
  }
}
