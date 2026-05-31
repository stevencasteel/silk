import { ISystem } from "../../contracts/ISystem";
import { SystemPhase, InitPhase } from "../../contracts/SystemPhase";
import {
  TransformComponent,
  KinematicVelocityComponent,
  KinematicTargetComponent
} from "../../core/ecs/Components";
import { SetKinematicVelocityCommand } from "../commands/PhysicsCommands";
import { ARENA_CONFIG, CANONICAL_UNITS } from "../../core/engine/ArenaConfig";
import { GameEvent } from "../../core/events/GameEvents";
import { SystemContext } from "../../core/engine/SystemContext";
import * as BABYLON from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms))
  ]);
}

export class HavokPhysicsSystem implements ISystem {
  readonly phase = SystemPhase.PhysicsStep;
  readonly initPhase = InitPhase.Bootstrap;
  private havokPlugin: BABYLON.HavokPlugin | null = null;
  private static isInitialized = false;

  private barriers: {
    body: BABYLON.PhysicsBody;
    shape: BABYLON.PhysicsShape;
    mesh: BABYLON.Mesh;
  }[] = [];

  private _scratchPos = new BABYLON.Vector3();
  private _scratchRot = new BABYLON.Quaternion();

  constructor(private context: SystemContext) {}

  public async init(): Promise<void> {
    this.registerCommands();
    const scene = this.context.visualQuery.getScene();
    if (scene) {
      this.context.broker.publish(GameEvent.GAME_BOOT_PROGRESS, {
        status: "LOADING PHYSICS ENGINE..."
      });
      try {
        const HAVOK_TIMEOUT_MS = 15000;
        let havokInstance;
        try {
          havokInstance = await withTimeout(
            HavokPhysics({ locateFile: () => "./HavokPhysics.wasm" }),
            HAVOK_TIMEOUT_MS,
            "Local HavokPhysics.wasm timed out"
          );
        } catch {
          this.context.broker.publish(GameEvent.GAME_BOOT_PROGRESS, {
            status: "PHYSICS LOCAL LOAD FAILED, TRYING CDN..."
          });
          try {
            havokInstance = await withTimeout(
              HavokPhysics({
                locateFile: () => "https://cdn.babylonjs.com/havok/HavokPhysics.wasm"
              }),
              HAVOK_TIMEOUT_MS,
              "CDN HavokPhysics.wasm timed out"
            );
          } catch {
            throw new Error("HavokPhysics failed to load from both local and CDN sources");
          }
        }

        if (HavokPhysicsSystem.isInitialized) {
          return;
        }
        HavokPhysicsSystem.isInitialized = true;

        this.havokPlugin = new BABYLON.HavokPlugin(true, havokInstance);
        scene.enablePhysics(
          new BABYLON.Vector3(0, CANONICAL_UNITS.GRAVITY.PHYSICAL_EARTH, 0),
          this.havokPlugin
        );

        const playHalfWidth = ARENA_CONFIG.HORIZONTAL.PLAY_AREA_HALF_WIDTH;
        const wallThickness = 1.0;
        const wallHeight = ARENA_CONFIG.VERTICAL.WALL_GEOMETRY_HEIGHT;
        const wallY = ARENA_CONFIG.VERTICAL.WALL_GEOMETRY_HEIGHT * 0.1;
        const floorWidth = playHalfWidth * 2 + 4;

        this.createStaticBarrier(
          "physFloor",
          new BABYLON.Vector3(floorWidth, 1.0, 16.0),
          new BABYLON.Vector3(0.0, ARENA_CONFIG.VERTICAL.FLOOR_Y - 0.5, 0.0),
          { friction: 0.5, restitution: 0.25 },
          scene
        );

        this.createStaticBarrier(
          "physLeft",
          new BABYLON.Vector3(wallThickness, wallHeight, 16.0),
          new BABYLON.Vector3(-(playHalfWidth + wallThickness / 2), wallY, 0.0),
          { friction: 0.3, restitution: 0.4 },
          scene
        );

        this.createStaticBarrier(
          "physRight",
          new BABYLON.Vector3(wallThickness, wallHeight, 16.0),
          new BABYLON.Vector3(playHalfWidth + wallThickness / 2, wallY, 0.0),
          { friction: 0.3, restitution: 0.4 },
          scene
        );

        this.createStaticBarrier(
          "physFront",
          new BABYLON.Vector3(floorWidth, wallHeight, 1.0),
          new BABYLON.Vector3(0.0, wallY, -3.5),
          { friction: 0.1, restitution: 0.5 },
          scene
        );

        this.createStaticBarrier(
          "physBack",
          new BABYLON.Vector3(floorWidth, wallHeight, 1.0),
          new BABYLON.Vector3(0.0, wallY, 3.5),
          { friction: 0.1, restitution: 0.5 },
          scene
        );

        console.log("[HavokPhysicsSystem] Havok initialized successfully.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[HavokPhysicsSystem] Failed to load Havok:", msg);
        this.context.broker.publish(GameEvent.GAME_BOOT_PROGRESS, {
          status: `PHYSICS UNAVAILABLE: ${msg}`
        });
      }
    }
  }

  private createStaticBarrier(
    name: string,
    size: BABYLON.Vector3,
    position: BABYLON.Vector3,
    physicsMaterial: { friction: number; restitution: number },
    scene: BABYLON.Scene
  ): BABYLON.PhysicsBody {
    const mesh = BABYLON.MeshBuilder.CreateBox(
      name,
      { width: size.x, height: size.y, depth: size.z },
      scene
    );
    mesh.position.copyFrom(position);
    mesh.isVisible = false;

    const shape = new BABYLON.PhysicsShapeBox(
      BABYLON.Vector3.Zero(),
      BABYLON.Quaternion.Identity(),
      size,
      scene
    );
    shape.material = physicsMaterial;

    const body = new BABYLON.PhysicsBody(mesh, BABYLON.PhysicsMotionType.STATIC, false, scene);
    body.shape = shape;
    body.setMassProperties({ mass: 0 });

    this.barriers.push({ body, shape, mesh });
    return body;
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

  private setMeshTargetTransform(entityId: number, trans: TransformComponent | undefined): void {
    const mesh = this.context.visualQuery.getTransformNode(entityId) as BABYLON.AbstractMesh | null;
    if (mesh && mesh.physicsBody && trans) {
      this._scratchPos.set(trans.x, trans.y, trans.z);
      this._scratchRot.set(trans.qx, trans.qy, trans.qz, trans.qw);
      mesh.physicsBody.setTargetTransform(this._scratchPos, this._scratchRot);
    }
  }

  public update(): void {
    this.context.commands.flush();
    const transforms = this.context.stores.get<TransformComponent>("transform");
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

    this.setMeshTargetTransform(this.context.refs.player, pTrans);
    this.setMeshTargetTransform(this.context.refs.weaver, wTrans);
  }

  public dispose(): void {
    this.barriers.forEach((b) => {
      b.body.dispose();
      b.shape.dispose();
      b.mesh.dispose();
    });
    this.barriers = [];
    if (this.havokPlugin) {
      this.havokPlugin.dispose();
      this.havokPlugin = null;
    }
    HavokPhysicsSystem.isInitialized = false;
  }
}
