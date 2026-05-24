import { ARENA_CONFIG, CANONICAL_UNITS, VISUAL_JUICE_CONFIG } from "../../core/engine/ArenaConfig";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import * as BABYLON from "@babylonjs/core";

interface PooledParticle {
  mesh: BABYLON.Mesh;
  velocity: BABYLON.Vector3;
  lifeRemaining: number;
  maxLife: number;
  active: boolean;
}

interface ActiveDebris {
  mesh: BABYLON.Mesh;
  body: BABYLON.PhysicsBody | null;
  velocity: BABYLON.Vector3;
  angularVelocity: BABYLON.Vector3;
  lifeRemaining: number;
}

export class JuiceSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;

  private particlePool: PooledParticle[] = [];
  private poolSize = 64;
  private nextPoolIndex = 0;
  private parentNode: BABYLON.TransformNode | null = null;
  private unsubscribes: (() => void)[] = [];

  private activeDebrisList: ActiveDebris[] = [];
  private debrisMat: BABYLON.PBRMaterial | null = null;
  private playerState: string = "AIRBORNE";

  constructor(
    private broker: EventBroker,
    private refs: EntityRefs,
    private visualRegistry: IVisualRegistry
  ) {}

  public init(): void {
    const scene = this.visualRegistry.getScene();
    if (!scene) return;

    this.parentNode = new BABYLON.TransformNode("juiceParticleRoot", scene);

    this.debrisMat = new BABYLON.PBRMaterial("debrisMat", scene);
    this.debrisMat.albedoColor = new BABYLON.Color3(0.1, 0.1, 0.15);
    this.debrisMat.emissiveColor = new BABYLON.Color3(0.9, 0.1, 0.1);
    this.debrisMat.emissiveIntensity = 3.5;
    this.debrisMat.metallic = 0.8;
    this.debrisMat.roughness = 0.4;

    for (let i = 0; i < this.poolSize; i++) {
      const box = BABYLON.MeshBuilder.CreateBox("juiceParticle_" + i, { size: 0.15 }, scene);
      const mat = new BABYLON.StandardMaterial("juiceParticleMat_" + i, scene);
      mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
      mat.disableLighting = true;
      box.material = mat;
      box.parent = this.parentNode;
      box.setEnabled(false);

      this.particlePool.push({
        mesh: box,
        velocity: new BABYLON.Vector3(),
        lifeRemaining: 0,
        maxLife: 1.0,
        active: false
      });
    }

    const config = VISUAL_JUICE_CONFIG.PARTICLES;

    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.PLAYER_DAMAGED, () => {
        const playerNode = this.visualRegistry.getTransformNode(this.refs.player);
        if (playerNode) {
          this.spawnBurst(
            playerNode.position,
            new BABYLON.Color3(0.13, 0.77, 0.36),
            config.BURST.PLAYER.COUNT,
            config.BURST.PLAYER
          );
        }
      })
    );

    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.WEAVER_DAMAGED, () => {
        const weaverNode = this.visualRegistry.getTransformNode(this.refs.weaver);
        if (weaverNode) {
          this.spawnBurst(
            weaverNode.position,
            new BABYLON.Color3(0.93, 0.22, 0.22),
            config.BURST.WEAVER.COUNT,
            config.BURST.WEAVER
          );
        }
      })
    );

    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.PLAYER_LANDED, (payload: { x: number; y: number }) => {
        const pos = new BABYLON.Vector3(payload.x, payload.y, 0);
        this.spawnLandingDust(pos);
      })
    );

    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.PLAYER_WALL_HIT, (payload: { x: number; y: number; wallNormalX: number }) => {
        const pos = new BABYLON.Vector3(payload.x, payload.y, 0);
        this.spawnWallSparks(pos, payload.wallNormalX);
      })
    );

    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.PROJECTILE_IMPACT, (payload: { x: number; y: number; isWall: boolean }) => {
        const pos = new BABYLON.Vector3(payload.x, payload.y, 0);
        this.spawnWebSplat(pos);
      })
    );

    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.WEAVER_DIED, () => {
        const weaverNode = this.visualRegistry.getTransformNode(this.refs.weaver);
        if (weaverNode) {
          const sceneObj = this.visualRegistry.getScene();
          if (sceneObj) {
            this.spawnDeathDebris(weaverNode.position, sceneObj);
          }
          weaverNode.setEnabled(false);
        }
      })
    );

    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.PLAYER_STATE_CHANGE, (payload: { state: string }) => {
        this.playerState = payload.state;
      })
    );

    this.unsubscribes.push(
      this.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.clearDebris();
        this.playerState = "AIRBORNE";
        const weaverNode = this.visualRegistry.getTransformNode(this.refs.weaver);
        if (weaverNode) {
          weaverNode.setEnabled(true);
        }
      })
    );
  }

  private spawnBurst(
    position: BABYLON.Vector3,
    color: BABYLON.Color3,
    count: number,
    settings: {
      readonly VELOCITY_Y_MIN: number;
      readonly VELOCITY_Y_MAX: number;
      readonly VELOCITY_Z_MAX: number;
      readonly VELOCITY_SPEED_MIN: number;
      readonly VELOCITY_SPEED_MAX: number;
      readonly LIFE_MIN: number;
      readonly LIFE_MAX: number;
    }
  ): void {
    for (let i = 0; i < count; i++) {
      const particle = this.particlePool[this.nextPoolIndex];
      particle.mesh.position.copyFrom(position);

      const theta = Math.random() * 2.0 * Math.PI;
      const speedSpan = settings.VELOCITY_SPEED_MAX - settings.VELOCITY_SPEED_MIN;
      const r = settings.VELOCITY_SPEED_MIN + Math.random() * speedSpan;
      
      const ySpan = settings.VELOCITY_Y_MAX - settings.VELOCITY_Y_MIN;
      const vy = settings.VELOCITY_Y_MIN + Math.random() * ySpan;
      const vz = (Math.random() - 0.5) * settings.VELOCITY_Z_MAX;

      particle.velocity.set(Math.cos(theta) * r, vy, vz);
      particle.lifeRemaining = settings.LIFE_MIN + Math.random() * (settings.LIFE_MAX - settings.LIFE_MIN);
      particle.maxLife = particle.lifeRemaining;
      particle.active = true;
      particle.mesh.setEnabled(true);

      const mat = particle.mesh.material as BABYLON.StandardMaterial;
      if (mat) {
        mat.emissiveColor.copyFrom(color);
      }

      this.nextPoolIndex = (this.nextPoolIndex + 1) % this.poolSize;
    }
  }

  private spawnLandingDust(position: BABYLON.Vector3): void {
    const config = VISUAL_JUICE_CONFIG.PARTICLES.BURST.LANDING;
    const count = config.COUNT;
    const color = new BABYLON.Color3(0.65, 0.65, 0.68);
    for (let i = 0; i < count; i++) {
      const particle = this.particlePool[this.nextPoolIndex];
      particle.mesh.position.copyFrom(position);

      const vx = (Math.random() - 0.5) * config.VELOCITY_X_MAX;
      const vy = Math.random() * config.VELOCITY_Y_MAX;
      const vz = (Math.random() - 0.5) * config.VELOCITY_Z_MAX;

      particle.velocity.set(vx, vy, vz);
      particle.lifeRemaining = config.LIFE_MIN + Math.random() * (config.LIFE_MAX - config.LIFE_MIN);
      particle.maxLife = particle.lifeRemaining;
      particle.active = true;
      particle.mesh.setEnabled(true);

      const mat = particle.mesh.material as BABYLON.StandardMaterial;
      if (mat) mat.emissiveColor.copyFrom(color);

      this.nextPoolIndex = (this.nextPoolIndex + 1) % this.poolSize;
    }
  }

  private spawnWallSparks(position: BABYLON.Vector3, wallNormalX: number): void {
    const config = VISUAL_JUICE_CONFIG.PARTICLES.BURST.WALL;
    const count = config.COUNT;
    const color = new BABYLON.Color3(1.0, 0.85, 0.35);
    for (let i = 0; i < count; i++) {
      const particle = this.particlePool[this.nextPoolIndex];
      particle.mesh.position.copyFrom(position);

      const xSpan = config.VELOCITY_X_MAX - config.VELOCITY_X_MIN;
      const vx = wallNormalX * (config.VELOCITY_X_MIN + Math.random() * xSpan);
      const vy = (Math.random() - 0.3) * config.VELOCITY_Y_MAX;
      const vz = (Math.random() - 0.5) * config.VELOCITY_Z_MAX;

      particle.velocity.set(vx, vy, vz);
      particle.lifeRemaining = config.LIFE_MIN + Math.random() * (config.LIFE_MAX - config.LIFE_MIN);
      particle.maxLife = particle.lifeRemaining;
      particle.active = true;
      particle.mesh.setEnabled(true);

      const mat = particle.mesh.material as BABYLON.StandardMaterial;
      if (mat) mat.emissiveColor.copyFrom(color);

      this.nextPoolIndex = (this.nextPoolIndex + 1) % this.poolSize;
    }
  }

  private spawnWebSplat(position: BABYLON.Vector3): void {
    const config = VISUAL_JUICE_CONFIG.PARTICLES.BURST.PROJECTILE;
    const count = config.COUNT;
    const color = new BABYLON.Color3(0.95, 0.95, 0.98);
    for (let i = 0; i < count; i++) {
      const particle = this.particlePool[this.nextPoolIndex];
      particle.mesh.position.copyFrom(position);

      const angle = Math.random() * Math.PI * 2.0;
      const speed = config.SPEED_MIN + Math.random() * (config.SPEED_MAX - config.SPEED_MIN);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const vz = (Math.random() - 0.5) * config.VELOCITY_Z_MAX;

      particle.velocity.set(vx, vy, vz);
      particle.lifeRemaining = config.LIFE_MIN + Math.random() * (config.LIFE_MAX - config.LIFE_MIN);
      particle.maxLife = particle.lifeRemaining;
      particle.active = true;
      particle.mesh.setEnabled(true);

      const mat = particle.mesh.material as BABYLON.StandardMaterial;
      if (mat) mat.emissiveColor.copyFrom(color);

      this.nextPoolIndex = (this.nextPoolIndex + 1) % this.poolSize;
    }
  }

  private spawnDeathDebris(pos: BABYLON.Vector3, scene: BABYLON.Scene): void {
    const weaverMesh = this.visualRegistry.getTransformNode(this.refs.weaver) as BABYLON.Mesh | null;
    const activeMat = weaverMesh?.material || this.debrisMat;
    const usePhysics = scene.isPhysicsEnabled();
    const config = VISUAL_JUICE_CONFIG.PARTICLES.DEBRIS;

    // ==============================================================================
    // LAYER 1: OUTER SHELL (20 Flat Triangles flying out quickly)
    // ==============================================================================
    const proxyShell = BABYLON.MeshBuilder.CreateIcoSphere("shellProxy", { radius: ARENA_CONFIG.ENTITY.WEAVER_RADIUS * 1.05, subdivisions: 0 }, scene);
    const shellPos = proxyShell.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const shellInd = proxyShell.getIndices();
    const shellNorm = proxyShell.getVerticesData(BABYLON.VertexBuffer.NormalKind);

    if (shellPos && shellInd) {
      for (let i = 0; i < shellInd.length; i += 3) {
        const i1 = shellInd[i], i2 = shellInd[i+1], i3 = shellInd[i+2];
        const p1 = new BABYLON.Vector3(shellPos[i1*3], shellPos[i1*3+1], shellPos[i1*3+2]);
        const p2 = new BABYLON.Vector3(shellPos[i2*3], shellPos[i2*3+1], shellPos[i2*3+2]);
        const p3 = new BABYLON.Vector3(shellPos[i3*3], shellPos[i3*3+1], shellPos[i3*3+2]);
        const centroid = p1.add(p2).add(p3).scale(1/3);
        
        const customMesh = new BABYLON.Mesh("shard_" + i, scene);
        const vertexData = new BABYLON.VertexData();
        vertexData.positions = [
          p1.x - centroid.x, p1.y - centroid.y, p1.z - centroid.z,
          p2.x - centroid.x, p2.y - centroid.y, p2.z - centroid.z,
          p3.x - centroid.x, p3.y - centroid.y, p3.z - centroid.z
        ];
        vertexData.indices = [0, 1, 2];
        
        if (shellNorm) {
          vertexData.normals = [
            shellNorm[i1*3], shellNorm[i1*3+1], shellNorm[i1*3+2],
            shellNorm[i2*3], shellNorm[i2*3+1], shellNorm[i2*3+2],
            shellNorm[i3*3], shellNorm[i3*3+1], shellNorm[i3*3+2]
          ];
        }
        
        vertexData.applyToMesh(customMesh);
        customMesh.position = pos.add(centroid);
        customMesh.material = activeMat;

        // Guarantee collision volume by extracting the exact extents
        customMesh.computeWorldMatrix(true);
        customMesh.refreshBoundingInfo(true);
        const bbox = customMesh.getBoundingInfo();
        const extents = bbox.maximum.subtract(bbox.minimum);
        extents.x = Math.max(0.2, Math.abs(extents.x));
        extents.y = Math.max(0.2, Math.abs(extents.y));
        extents.z = Math.max(0.2, Math.abs(extents.z));

        let body: BABYLON.PhysicsBody | null = null;
        const outward = centroid.clone().normalize();
        const speed = config.VELOCITY_Y_MIN + Math.random() * (config.VELOCITY_Y_MAX - config.VELOCITY_Y_MIN) * 1.5;
        const vx = outward.x * speed + (Math.random() - 0.5) * 8.0;
        const vy = outward.y * speed + (Math.random() - 0.5) * 8.0;
        const vz = outward.z * speed + (Math.random() - 0.5) * 8.0;

        if (usePhysics) {
          const shape = new BABYLON.PhysicsShapeBox(BABYLON.Vector3.Zero(), BABYLON.Quaternion.Identity(), extents, scene);
          shape.material = { friction: 0.5, restitution: 0.6 };
          body = new BABYLON.PhysicsBody(customMesh, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
          body.shape = shape;
          body.setMassProperties({ mass: config.MASS * 0.5 });
          body.setLinearVelocity(new BABYLON.Vector3(vx, vy, vz));
          body.setAngularVelocity(new BABYLON.Vector3(
            (Math.random() - 0.5) * config.ANGULAR_MAX * 2,
            (Math.random() - 0.5) * config.ANGULAR_MAX * 2,
            (Math.random() - 0.5) * config.ANGULAR_MAX * 2
          ));
        }

        this.activeDebrisList.push({
          mesh: customMesh,
          body: body,
          velocity: new BABYLON.Vector3(vx, vy, vz),
          angularVelocity: new BABYLON.Vector3(0, 0, 0),
          lifeRemaining: config.LIFE * (0.8 + Math.random() * 0.4)
        });
      }
    }
    proxyShell.dispose();

    // ==============================================================================
    // LAYER 2: INNER CORE (10 Heavy Sealed Wedges)
    // ==============================================================================
    const chunks = 10;
    const proxyCore = BABYLON.MeshBuilder.CreateIcoSphere("coreProxy", { radius: ARENA_CONFIG.ENTITY.WEAVER_RADIUS * 0.95, subdivisions: 3 }, scene);
    const corePos = proxyCore.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const coreInd = proxyCore.getIndices();

    if (corePos && coreInd) {
      const bucketTris: number[][] = Array.from({ length: chunks }, () => []);
      for (let i = 0; i < coreInd.length; i += 3) {
        const i1 = coreInd[i], i2 = coreInd[i+1], i3 = coreInd[i+2];
        const cx = (corePos[i1*3] + corePos[i2*3] + corePos[i3*3]) / 3;
        const cz = (corePos[i1*3+2] + corePos[i2*3+2] + corePos[i3*3+2]) / 3;
        let angle = Math.atan2(cz, cx);
        if (angle < 0) angle += Math.PI * 2;
        let bucket = Math.floor((angle / (Math.PI * 2)) * chunks);
        if (bucket === chunks) bucket = chunks - 1;
        bucketTris[bucket].push(i1, i2, i3);
      }

      for (let b = 0; b < chunks; b++) {
        const tris = bucketTris[b];
        if (tris.length === 0) continue;

        const edgeMap = new Map<string, { count: number, directed: [number, number] }>();
        for (let i = 0; i < tris.length; i += 3) {
          const edges = [ [tris[i], tris[i+1]], [tris[i+1], tris[i+2]], [tris[i+2], tris[i]] ];
          for (const e of edges) {
            const key = Math.min(e[0], e[1]) + "_" + Math.max(e[0], e[1]);
            if (!edgeMap.has(key)) { edgeMap.set(key, { count: 0, directed: e as [number, number] }); }
            edgeMap.get(key)!.count++;
          }
        }
        const boundaries: [number, number][] = [];
        for (const val of edgeMap.values()) {
          if (val.count === 1) boundaries.push(val.directed);
        }

        const localPositions: number[] = [];
        const localIndices: number[] = [];
        const oldToNew = new Map<number, number>();

        localPositions.push(0, 0, 0);
        const centerIndex = 0;
        const getLocal = (oldIdx: number) => {
          if (oldToNew.has(oldIdx)) return oldToNew.get(oldIdx)!;
          const newIdx = localPositions.length / 3;
          localPositions.push(corePos[oldIdx*3], corePos[oldIdx*3+1], corePos[oldIdx*3+2]);
          oldToNew.set(oldIdx, newIdx);
          return newIdx;
        };

        for (let i = 0; i < tris.length; i += 3) {
          localIndices.push(getLocal(tris[i]), getLocal(tris[i+1]), getLocal(tris[i+2]));
        }
        for (const e of boundaries) {
          localIndices.push(getLocal(e[1]), getLocal(e[0]), centerIndex);
        }

        let cx = 0, cy = 0, cz = 0;
        const vCount = localPositions.length / 3;
        for (let i = 0; i < localPositions.length; i += 3) {
          cx += localPositions[i]; cy += localPositions[i+1]; cz += localPositions[i+2];
        }
        cx /= vCount; cy /= vCount; cz /= vCount;
        const centroid = new BABYLON.Vector3(cx, cy, cz);

        for (let i = 0; i < localPositions.length; i += 3) {
          localPositions[i] = (localPositions[i] - cx) * 0.90;
          localPositions[i+1] = (localPositions[i+1] - cy) * 0.90;
          localPositions[i+2] = (localPositions[i+2] - cz) * 0.90;
        }

        const customMesh = new BABYLON.Mesh("chunk_" + b, scene);
        const vertexData = new BABYLON.VertexData();
        vertexData.positions = localPositions;
        vertexData.indices = localIndices;
        const computedNormals: number[] = [];
        BABYLON.VertexData.ComputeNormals(localPositions, localIndices, computedNormals);
        vertexData.normals = computedNormals;
        vertexData.applyToMesh(customMesh);
        
        const outward = centroid.clone().normalize();
        customMesh.position = pos.add(centroid).add(outward.scale(0.3));
        customMesh.material = activeMat;

        // Guarantee collision volume by extracting exact extents
        customMesh.computeWorldMatrix(true);
        customMesh.refreshBoundingInfo(true);
        const bbox = customMesh.getBoundingInfo();
        const extents = bbox.maximum.subtract(bbox.minimum);
        extents.x = Math.max(0.2, Math.abs(extents.x));
        extents.y = Math.max(0.2, Math.abs(extents.y));
        extents.z = Math.max(0.2, Math.abs(extents.z));

        let body: BABYLON.PhysicsBody | null = null;
        const speed = config.VELOCITY_Y_MIN + Math.random() * (config.VELOCITY_Y_MAX - config.VELOCITY_Y_MIN) * 0.7;
        const vx = outward.x * speed + (Math.random() - 0.5) * 3.0;
        const vy = outward.y * speed + (Math.random() - 0.5) * 3.0;
        const vz = outward.z * speed + (Math.random() - 0.5) * 3.0;

        if (usePhysics) {
          const shape = new BABYLON.PhysicsShapeBox(BABYLON.Vector3.Zero(), BABYLON.Quaternion.Identity(), extents, scene);
          shape.material = { friction: 0.8, restitution: 0.6 }; 
          body = new BABYLON.PhysicsBody(customMesh, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
          body.shape = shape;
          body.setMassProperties({ mass: config.MASS * 2.5 }); 
          body.setLinearVelocity(new BABYLON.Vector3(vx, vy, vz));
          body.setAngularVelocity(new BABYLON.Vector3(
            (Math.random() - 0.5) * config.ANGULAR_MAX,
            (Math.random() - 0.5) * config.ANGULAR_MAX,
            (Math.random() - 0.5) * config.ANGULAR_MAX
          ));
        }

        this.activeDebrisList.push({
          mesh: customMesh,
          body: body,
          velocity: new BABYLON.Vector3(vx, vy, vz),
          angularVelocity: new BABYLON.Vector3(0, 0, 0),
          lifeRemaining: config.LIFE
        });
      }
    }
    proxyCore.dispose();
  }

  private spawnLaunchTrail(position: BABYLON.Vector3): void {
    const particle = this.particlePool[this.nextPoolIndex];
    const trail = VISUAL_JUICE_CONFIG.PARTICLES.BURST.TRAIL;

    particle.mesh.position.copyFrom(position);
    particle.mesh.position.x += (Math.random() - 0.5) * trail.OFFSET_X;
    particle.mesh.position.y += (Math.random() - 0.5) * trail.OFFSET_Y;

    const vx = (Math.random() - 0.5) * trail.VELOCITY_X_MAX;
    const vy = (Math.random() - 0.5) * trail.VELOCITY_Y_MAX;
    const vz = (Math.random() - 0.5) * trail.VELOCITY_Z_MAX;

    particle.velocity.set(vx, vy, vz);
    particle.lifeRemaining = trail.LIFE_MIN + Math.random() * (trail.LIFE_MAX - trail.LIFE_MIN);
    particle.maxLife = particle.lifeRemaining;
    particle.active = true;
    particle.mesh.setEnabled(true);

    const mat = particle.mesh.material as BABYLON.StandardMaterial;
    if (mat) {
      mat.emissiveColor.set(0.13, 0.77, 0.36);
    }

    this.nextPoolIndex = (this.nextPoolIndex + 1) % this.poolSize;
  }

  public update(dt: number): void {
    const gravity = CANONICAL_UNITS.GRAVITY.JUICE_PARTICLE;
    for (let i = 0; i < this.poolSize; i++) {
      const p = this.particlePool[i];
      if (!p.active) continue;

      p.lifeRemaining -= dt;
      if (p.lifeRemaining <= 0) {
        p.active = false;
        p.mesh.setEnabled(false);
        continue;
      }

      p.velocity.y += gravity * dt;
      p.mesh.position.x += p.velocity.x * dt;
      p.mesh.position.y += p.velocity.y * dt;
      p.mesh.position.z += p.velocity.z * dt;

      const ratio = p.lifeRemaining / p.maxLife;
      p.mesh.scaling.set(ratio, ratio, ratio);
    }

    if (this.playerState === "LAUNCHING") {
      const playerNode = this.visualRegistry.getTransformNode(this.refs.player) as BABYLON.Mesh | null;
      if (playerNode) {
        this.spawnLaunchTrail(playerNode.position);
      }
    }

    const config = VISUAL_JUICE_CONFIG.PARTICLES.DEBRIS;

    for (let i = this.activeDebrisList.length - 1; i >= 0; i--) {
      const d = this.activeDebrisList[i];
      d.lifeRemaining -= dt;

      if (d.lifeRemaining <= 0) {
        if (d.body) {
           if (d.body.shape) d.body.shape.dispose();
           d.body.dispose();
        }
        d.mesh.dispose();
        this.activeDebrisList.splice(i, 1);
      } else {
        if (d.lifeRemaining < config.SCALE_DECAY_TIME) {
          // FIX 4: Detach physics body before scaling so collision hulls don't mismatch causing hovering
          if (d.body) {
            if (d.body.shape) d.body.shape.dispose();
            d.body.dispose();
            d.body = null;
            d.velocity.y = -4.0; // Fallback math gravity so it sinks gracefully
          }
          const ratio = d.lifeRemaining / config.SCALE_DECAY_TIME;
          d.mesh.scaling.set(ratio, ratio, ratio);
        }

        if (d.body) {
          // Native Havok glass walls handle Z-axis bounding natively now
        } else {
          d.velocity.y += CANONICAL_UNITS.GRAVITY.PLAYER_KINEMATIC * dt;
          d.mesh.position.x += d.velocity.x * dt;
          d.mesh.position.y += d.velocity.y * dt;
          d.mesh.rotation.x += d.angularVelocity.x * dt;
          d.mesh.rotation.y += d.angularVelocity.y * dt;
          d.mesh.rotation.z += d.angularVelocity.z * dt;
        }
      }
    }
  }

  private clearDebris(): void {
    for (const d of this.activeDebrisList) {
      if (d.body) { if (d.body.shape) d.body.shape.dispose(); d.body.dispose(); }
      d.mesh.dispose();
    }
    this.activeDebrisList = [];
  }

  public dispose(): void {
    this.unsubscribes.forEach((unsub) => unsub());
    this.unsubscribes = [];
    this.clearDebris();
    if (this.parentNode) {
      this.parentNode.dispose();
    }
    this.particlePool.forEach((p) => {
      p.mesh.dispose();
      if (p.mesh.material) p.mesh.material.dispose();
    });
    this.particlePool = [];
  }
}
