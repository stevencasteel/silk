import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import {
  TransformComponent,
  KinematicVelocityComponent,
  KinematicTargetComponent
} from "../../core/ecs/Components";
import { SetKinematicVelocityCommand } from "../commands/PhysicsCommands";
import { ARENA_CONFIG, CANONICAL_UNITS } from "../../core/engine/ArenaConfig";
import { SystemContext } from "../../core/engine/SystemContext";
import * as BABYLON from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";

export class HavokPhysicsSystem implements ISystem {
  readonly phase = SystemPhase.PhysicsStep;
  readonly initPhase = InitPhase.Bootstrap;
  private havokPlugin: BABYLON.HavokPlugin | null = null;

  constructor(private context: SystemContext) {}

  public async init(): Promise<void> {
    this.registerCommands();
    const scene = this.context.visualRegistry.getScene();
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
        const physFloor = BABYLON.MeshBuilder.CreateBox("physFloor", { width: floorWidth, height: 1.0, depth: 16 }, scene);
        physFloor.position.set(0, ARENA_CONFIG.VERTICAL.FLOOR_Y - 0.5, 0);
        physFloor.isVisible = false;
        
        const floorShape = new BABYLON.PhysicsShapeBox(
          BABYLON.Vector3.Zero(), 
          BABYLON.Quaternion.Identity(), 
          new BABYLON.Vector3(floorWidth, 1.0, 16), 
          scene
        );
        floorShape.material = { friction: 0.5, restitution: 0.25 };
        const floorBody = new BABYLON.PhysicsBody(physFloor, BABYLON.PhysicsMotionType.STATIC, false, scene);
        floorBody.shape = floorShape;
        floorBody.setMassProperties({ mass: 0 });

        const physLeft = BABYLON.MeshBuilder.CreateBox("physLeft", { width: wallThickness, height: wallHeight, depth: 16 }, scene);
        physLeft.position.set(-(playHalfWidth + wallThickness / 2), wallY, 0);
        physLeft.isVisible = false;
        
        const wallShape = new BABYLON.PhysicsShapeBox(
          BABYLON.Vector3.Zero(), 
          BABYLON.Quaternion.Identity(), 
          new BABYLON.Vector3(wallThickness, wallHeight, 16), 
          scene
        );
        wallShape.material = { friction: 0.3, restitution: 0.4 };
        const leftBody = new BABYLON.PhysicsBody(physLeft, BABYLON.PhysicsMotionType.STATIC, false, scene);
        leftBody.shape = wallShape;
        leftBody.setMassProperties({ mass: 0 });

        const physRight = BABYLON.MeshBuilder.CreateBox("physRight", { width: wallThickness, height: wallHeight, depth: 16 }, scene);
        physRight.position.set((playHalfWidth + wallThickness / 2), wallY, 0);
        physRight.isVisible = false;
        
        const rightBody = new BABYLON.PhysicsBody(physRight, BABYLON.PhysicsMotionType.STATIC, false, scene);
        rightBody.shape = wallShape; 
        rightBody.setMassProperties({ mass: 0 });

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
        backBody.shape = frontBackShape; 
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
    this.context.commands.register<SetKinematicVelocityCommand>("SET_KINEMATIC_VELOCITY", (cmd) => {
      const velocities = this.context.stores.get<KinematicVelocityComponent>("velocity");
      const vel = velocities.get(cmd.entityId);
      if (vel) {
        vel.x = cmd.x;
        vel.y = cmd.y;
        vel.z = cmd.z;
      }
    });
  }

  public update(): void {
    this.context.commands.flush();
    const transforms = this.context.stores.get<TransformComponent>("transform");
    for (const [, curr] of transforms.entries()) {
      curr.prevX = curr.x;
      curr.prevY = curr.y;
      curr.prevZ = curr.z;
      curr.prevQx = curr.qx;
      curr.prevQy = curr.qy;
      curr.prevQz = curr.qz;
      curr.prevQw = curr.qw;
    }
    const targets = this.context.stores.get<KinematicTargetComponent>("target");
    const pTarget = targets.get(this.context.refs.player);
    const pTrans = transforms.get(this.context.refs.player);
    if (pTrans && pTarget && pTarget.active) {
      pTrans.x = pTarget.x;
      pTrans.y = pTarget.y;
      pTrans.z = pTarget.z;
    }
    const wTarget = targets.get(this.context.refs.weaver);
    const wTrans = transforms.get(this.context.refs.weaver);
    if (wTrans && wTarget && wTarget.active) {
      wTrans.x = wTarget.x;
      wTrans.y = wTarget.y;
      wTrans.z = wTarget.z;
    }
  }
}
