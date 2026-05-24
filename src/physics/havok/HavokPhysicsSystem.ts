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

        const floorWidth = playHalfWidth * 2 + 4;
        const physFloor = BABYLON.MeshBuilder.CreateBox("physFloor", { width: floorWidth, height: 1.0, depth: 6 }, scene);
        physFloor.position.set(0, ARENA_CONFIG.VERTICAL.FLOOR_Y - 0.5, 0);
        physFloor.isVisible = false;
        
        const floorShape = new BABYLON.PhysicsShapeBox(
          BABYLON.Vector3.Zero(), 
          BABYLON.Quaternion.Identity(), 
          new BABYLON.Vector3(floorWidth, 1.0, 6), 
          scene
        );
        floorShape.material = { friction: 0.5, restitution: 0.25 };
        const floorBody = new BABYLON.PhysicsBody(physFloor, BABYLON.PhysicsMotionType.STATIC, false, scene);
        floorBody.shape = floorShape;
        floorBody.setMassProperties({ mass: 0 });

        const physLeft = BABYLON.MeshBuilder.CreateBox("physLeft", { width: wallThickness, height: wallHeight, depth: 6 }, scene);
        physLeft.position.set(-(playHalfWidth + wallThickness / 2), wallY, 0);
        physLeft.isVisible = false;
        
        const wallShape = new BABYLON.PhysicsShapeBox(
          BABYLON.Vector3.Zero(), 
          BABYLON.Quaternion.Identity(), 
          new BABYLON.Vector3(wallThickness, wallHeight, 6), 
          scene
        );
        wallShape.material = { friction: 0.3, restitution: 0.4 };
        const leftBody = new BABYLON.PhysicsBody(physLeft, BABYLON.PhysicsMotionType.STATIC, false, scene);
        leftBody.shape = wallShape;
        leftBody.setMassProperties({ mass: 0 });

        const physRight = BABYLON.MeshBuilder.CreateBox("physRight", { width: wallThickness, height: wallHeight, depth: 6 }, scene);
        physRight.position.set((playHalfWidth + wallThickness / 2), wallY, 0);
        physRight.isVisible = false;
        
        const rightBody = new BABYLON.PhysicsBody(physRight, BABYLON.PhysicsMotionType.STATIC, false, scene);
        rightBody.shape = wallShape; // V2 REUSE: Sharing the exact same shape as the left wall
        rightBody.setMassProperties({ mass: 0 });

        // Invisible Front and Back walls to keep DYNAMIC physics objects inside the 2D plane natively
        const physFront = BABYLON.MeshBuilder.CreateBox("physFront", { width: floorWidth, height: wallHeight, depth: 1.0 }, scene);
        physFront.position.set(0, wallY, -3.5);
        physFront.isVisible = false;
        
        const frontBackShape = new BABYLON.PhysicsShapeBox(
          BABYLON.Vector3.Zero(), 
          BABYLON.Quaternion.Identity(), 
          new BABYLON.Vector3(floorWidth, wallHeight, 1.0), 
          scene
        );
        frontBackShape.material = { friction: 0.1, restitution: 0.5 };
        
        const frontBody = new BABYLON.PhysicsBody(physFront, BABYLON.PhysicsMotionType.STATIC, false, scene);
        frontBody.shape = frontBackShape;
        frontBody.setMassProperties({ mass: 0 });

        const physBack = BABYLON.MeshBuilder.CreateBox("physBack", { width: floorWidth, height: wallHeight, depth: 1.0 }, scene);
        physBack.position.set(0, wallY, 3.5);
        physBack.isVisible = false;
        
        const backBody = new BABYLON.PhysicsBody(physBack, BABYLON.PhysicsMotionType.STATIC, false, scene);
        backBody.shape = frontBackShape; // V2 REUSE: Share the front wall shape
        backBody.setMassProperties({ mass: 0 });

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
