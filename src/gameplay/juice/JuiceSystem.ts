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
    const config = VISUAL_JUICE_CONFIG.PARTICLES.DEBRIS;

    // ==============================================================================
    // LAYER 1: OUTER SHELL (20 Flat Triangles flying out quickly)
    // ==============================================================================
    const proxyShell = BABYLON.MeshBuilder.CreateIcoSphere("shellProxy", { radius: ARENA_CONFIG.ENTITY.WEAVER_RADIUS * 1.05, subdivisions: 0 }, scene);
    const shellPos = proxyShell.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const shellInd = proxyShell.getIndices();

    if (shellPos && shellInd) {
      for (let i = 0; i < shellInd.length; i += 3) {
        const i1 = shellInd[i], i2 = shellInd[i+1], i3 = shellInd[i+2];
        const p1 = new BABYLON.Vector3(shellPos[i1*3], shellPos[i1*3+1], shellPos[i1*3+2]);
        const p2 = new BABYLON.Vector3(shellPos[i2*3], shellPos[i2*3+1], shellPos[i2*3+2]);
        const p3 = new BABYLON.Vector3(shellPos[i3*3], shellPos[i3*3+1], shellPos[i3*3+2]);
        const centroid = p1.add(p2).add(p3).scale(1/3);
        const outward = centroid.clone().normalize();
        
        const customMesh = new BABYLON.Mesh("shard_" + i, scene);
        const vertexData = new BABYLON.VertexData();
        vertexData.positions = [
          p1.x - centroid.x, p1.y - centroid.y, p1.z - centroid.z,
          p2.x - centroid.x, p2.y - centroid.y, p2.z - centroid.z,
          p3.x - centroid.x, p3.y - centroid.y, p3.z - centroid.z
        ];
        vertexData.indices = [0, 1, 2];
        
        vertexData.applyToMesh(customMesh);
        customMesh.convertToFlatShadedMesh();

        // Nullify quaternion to allow Euler rotation to update beautifully
        customMesh.rotationQuaternion = null;
        customMesh.rotation.set(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        );

        // Disperse slightly outward so they are completely separated
        customMesh.position = pos.add(centroid).add(outward.scale(0.35));
        customMesh.material = activeMat;

        const speed = config.VELOCITY_Y_MIN + Math.random() * (config.VELOCITY_Y_MAX - config.VELOCITY_Y_MIN) * 1.5;
        const vx = outward.x * speed + (Math.random() - 0.5) * 8.0;
        const vy = outward.y * speed + (Math.random() - 0.5) * 8.0;
        const vz = (Math.random() - 0.5) * 1.5;

        // Dynamic continuous rotational speed
        const rotVelX = (Math.random() - 0.5) * config.ANGULAR_MAX;
        const rotVelY = (Math.random() - 0.5) * config.ANGULAR_MAX;
        const rotVelZ = (Math.random() - 0.5) * config.ANGULAR_MAX;

        this.activeDebrisList.push({
          mesh: customMesh,
          body: null, // Managed by our precise 2D planar collision solver
          velocity: new BABYLON.Vector3(vx, vy, vz),
          angularVelocity: new BABYLON.Vector3(rotVelX, rotVelY, rotVelZ),
          lifeRemaining: config.LIFE * (0.8 + Math.random() * 0.4)
        });
      }
    }
    proxyShell.dispose();

    // ==============================================================================
    // LAYER 2: INNER CORE (8 Heavy Solid Non-Overlapping Octant Shards)
    // ==============================================================================
    const coreRadius = ARENA_CONFIG.ENTITY.WEAVER_RADIUS * 0.75;
    const directions = [
      [-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1],
      [-1, -1, 1],  [1, -1, 1],  [-1, 1, 1],  [1, 1, 1]
    ];

    for (let b = 0; b < directions.length; b++) {
      const dirX = directions[b][0];
      const dirY = directions[b][1];
      const dirZ = directions[b][2];

      const v0 = new BABYLON.Vector3(0, 0, 0);
      const v1 = new BABYLON.Vector3(dirX * coreRadius, 0, 0);
      const v2 = new BABYLON.Vector3(0, dirY * coreRadius, 0);
      const v3 = new BABYLON.Vector3(0, 0, dirZ * coreRadius);

      const centroid = v0.add(v1).add(v2).add(v3).scale(1 / 4);
      const outward = centroid.clone().normalize();

      const localV0 = v0.subtract(centroid);
      const localV1 = v1.subtract(centroid);
      const localV2 = v2.subtract(centroid);
      const localV3 = v3.subtract(centroid);

      const localPositions = [
        localV0.x, localV0.y, localV0.z,
        localV1.x, localV1.y, localV1.z,
        localV2.x, localV2.y, localV2.z,
        localV3.x, localV3.y, localV3.z
      ];

      const vertices = [localV0, localV1, localV2, localV3];
      const faces = [
        [0, 1, 2],
        [0, 2, 3],
        [0, 3, 1],
        [1, 3, 2]
      ];

      const localIndices: number[] = [];
      const localCentroid = localV0.add(localV1).add(localV2).add(localV3).scale(1 / 4);

      for (let f = 0; f < faces.length; f++) {
        const idxA = faces[f][0];
        const idxB = faces[f][1];
        const idxC = faces[f][2];
        const a = vertices[idxA];
        const b = vertices[idxB];
        const c = vertices[idxC];
        
        const ab = b.subtract(a);
        const ac = c.subtract(a);
        const faceNormal = BABYLON.Vector3.Cross(ab, ac).normalize();
        
        const faceCenter = a.add(b).add(c).scale(1 / 3);
        const toFace = faceCenter.subtract(localCentroid);
        
        if (BABYLON.Vector3.Dot(faceNormal, toFace) < 0) {
          localIndices.push(idxA, idxC, idxB);
        } else {
          localIndices.push(idxA, idxB, idxC);
        }
      }

      const customMesh = new BABYLON.Mesh("core_shard_" + b, scene);
      const vertexData = new BABYLON.VertexData();
      vertexData.positions = localPositions;
      vertexData.indices = localIndices;

      const computedNormals: number[] = [];
      BABYLON.VertexData.ComputeNormals(localPositions, localIndices, computedNormals);
      vertexData.normals = computedNormals;
      vertexData.applyToMesh(customMesh);
      customMesh.convertToFlatShadedMesh();

      // Nullify quaternion for Euler rotation to function
      customMesh.rotationQuaternion = null;
      customMesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );

      // Create a small outer separation
      customMesh.position = pos.add(centroid).add(outward.scale(0.35));
      customMesh.material = activeMat;

      if (this.visualRegistry.registerShadowCaster) {
        this.visualRegistry.registerShadowCaster(customMesh);
      } else {
        customMesh.receiveShadows = true;
      }

      const speed = config.VELOCITY_Y_MIN + Math.random() * (config.VELOCITY_Y_MAX - config.VELOCITY_Y_MIN) * 0.8;
      const vx = outward.x * speed + (Math.random() - 0.5) * 5.0;
      const vy = outward.y * speed + (Math.random() - 0.5) * 5.0;
      const vz = (Math.random() - 0.5) * 1.5;

      const rotVelX = (Math.random() - 0.5) * config.ANGULAR_MAX;
      const rotVelY = (Math.random() - 0.5) * config.ANGULAR_MAX;
      const rotVelZ = (Math.random() - 0.5) * config.ANGULAR_MAX;

      this.activeDebrisList.push({
        mesh: customMesh,
        body: null,
        velocity: new BABYLON.Vector3(vx, vy, vz),
        angularVelocity: new BABYLON.Vector3(rotVelX, rotVelY, rotVelZ),
        lifeRemaining: config.LIFE * (0.9 + Math.random() * 0.3)
      });
    }
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
    const particleDrag = Math.pow(0.92, dt * 60.0);
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
      p.velocity.x *= particleDrag;
      p.velocity.y *= particleDrag;
      p.velocity.z *= particleDrag;
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
    const wallLimit = ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;
    const floorY = ARENA_CONFIG.VERTICAL.FLOOR_Y + 0.3;
    const playerNode = this.visualRegistry.getTransformNode(this.refs.player);

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
          if (d.body) {
            const currentVelocity = new BABYLON.Vector3();
            d.body.getLinearVelocityToRef(currentVelocity);
            d.velocity.copyFrom(currentVelocity);

            const currentAngular = new BABYLON.Vector3();
            d.body.getAngularVelocityToRef(currentAngular);
            d.angularVelocity.copyFrom(currentAngular);

            if (d.body.shape) d.body.shape.dispose();
            d.body.dispose();
            d.body = null;
          }
          const ratio = d.lifeRemaining / config.SCALE_DECAY_TIME;
          d.mesh.scaling.set(ratio, ratio, ratio);
        }

        if (!d.body) {
          // Dynamic 2.5D math physics updates
          d.velocity.y += CANONICAL_UNITS.GRAVITY.PLAYER_KINEMATIC * dt * 1.6;

          const debrisDrag = Math.pow(0.95, dt * 60.0);
          d.velocity.x *= debrisDrag;
          d.velocity.z *= debrisDrag;

          d.mesh.position.x += d.velocity.x * dt;
          d.mesh.position.y += d.velocity.y * dt;
          d.mesh.position.z += d.velocity.z * dt;

          // Tumbling Euler rotations across all axes
          d.mesh.rotation.x += d.angularVelocity.x * dt;
          d.mesh.rotation.y += d.angularVelocity.y * dt;
          d.mesh.rotation.z += d.angularVelocity.z * dt;

          // Elastic Wall Collisions
          if (d.mesh.position.x < -wallLimit) {
            d.mesh.position.x = -wallLimit;
            d.velocity.x *= -0.65; // Restitution bounce
            d.angularVelocity.y += (Math.random() - 0.5) * 6.0; // Spin on impact
          } else if (d.mesh.position.x > wallLimit) {
            d.mesh.position.x = wallLimit;
            d.velocity.x *= -0.65;
            d.angularVelocity.y += (Math.random() - 0.5) * 6.0;
          }

          // Elastic Floor Collisions
          if (d.mesh.position.y < floorY) {
            d.mesh.position.y = floorY;
            d.velocity.y *= -0.55;
            d.velocity.x *= 0.8; // Surface friction
            d.angularVelocity.x += (Math.random() - 0.5) * 4.0;
          }

          // Elastic Player Collisions
          if (playerNode) {
            const dx = d.mesh.position.x - playerNode.position.x;
            const dy = d.mesh.position.y - playerNode.position.y;
            const distSq = dx * dx + dy * dy;
            const pRadius = ARENA_CONFIG.ENTITY.PLAYER_RADIUS + 0.45;
            if (distSq < pRadius * pRadius) {
              const dist = Math.sqrt(distSq) || 0.1;
              const nx = dx / dist;
              const ny = dy / dist;
              d.mesh.position.x = playerNode.position.x + nx * pRadius;
              d.mesh.position.y = playerNode.position.y + ny * pRadius;
              const dot = d.velocity.x * nx + d.velocity.y * ny;
              if (dot < 0) {
                d.velocity.x -= dot * nx * 1.5;
                d.velocity.y -= dot * ny * 1.5;
                d.velocity.x += nx * 4.0;
                d.velocity.y += ny * 4.0;
              }
            }
          }

          // Inter-Debris Elastic Collisions
          for (let j = i - 1; j >= 0; j--) {
            const d2 = this.activeDebrisList[j];
            if (d2.body) continue;
            const dx = d2.mesh.position.x - d.mesh.position.x;
            const dy = d2.mesh.position.y - d.mesh.position.y;
            const distSq = dx * dx + dy * dy;

            const isPyramid1 = d.mesh.name.includes("core_shard");
            const isPyramid2 = d2.mesh.name.includes("core_shard");
            const r1 = isPyramid1 ? 0.60 : 0.16;
            const r2 = isPyramid2 ? 0.60 : 0.16;
            const minDist = r1 + r2;

            if (distSq < minDist * minDist) {
              const dist = Math.sqrt(distSq) || 0.1;
              const nx = dx / dist;
              const ny = dy / dist;

              // Separate overlapping shapes
              const overlap = minDist - dist;
              d.mesh.position.x -= nx * overlap * 0.5;
              d.mesh.position.y -= ny * overlap * 0.5;
              d2.mesh.position.x += nx * overlap * 0.5;
              d2.mesh.position.y += ny * overlap * 0.5;

              // Elastic response
              const kx = d.velocity.x - d2.velocity.x;
              const ky = d.velocity.y - d2.velocity.y;
              const p = kx * nx + ky * ny;
              if (p > 0) {
                d.velocity.x -= nx * p * 0.8;
                d.velocity.y -= ny * p * 0.8;
                d2.velocity.x += nx * p * 0.8;
                d2.velocity.y += ny * p * 0.8;

                // Add minor rotational spin transfer on crash
                d.angularVelocity.z += (Math.random() - 0.5) * 3.0;
                d2.angularVelocity.z += (Math.random() - 0.5) * 3.0;
              }
            }
          }
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
