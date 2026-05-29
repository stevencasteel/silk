import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { SystemContext } from "../../core/engine/SystemContext";
import { GameEvent } from "../../core/events/GameEvents";
import {
  ARENA_CONFIG,
  CANONICAL_UNITS,
  VISUAL_JUICE_CONFIG,
  POST_PROCESSING_PRESETS
} from "../../core/engine/ArenaConfig";
import * as BABYLON from "@babylonjs/core";

interface ActiveDebris {
  mesh: BABYLON.Mesh;
  body: BABYLON.PhysicsBody | null;
  velocity: BABYLON.Vector3;
  angularVelocity: BABYLON.Vector3;
  lifeRemaining: number;
}

export class WeaverShatterSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;

  private activeDebrisList: ActiveDebris[] = [];
  private debrisMat: BABYLON.PBRMaterial | null = null;
  private unsubscribes: (() => void)[] = [];

  constructor(private context: SystemContext) {}

  public init(): void {
    const scene = this.context.visualRegistry.getScene();
    if (!scene) return;

    this.debrisMat = new BABYLON.PBRMaterial("debrisMat", scene);
    this.debrisMat.albedoColor = new BABYLON.Color3(0.1, 0.1, 0.15);
    this.debrisMat.emissiveColor = new BABYLON.Color3(0.9, 0.1, 0.1);
    this.debrisMat.emissiveIntensity = 3.5;
    this.debrisMat.metallic = 0.8;
    this.debrisMat.roughness = 0.4;

    this.unsubscribes.push(
      this.context.broker.subscribe(GameEvent.WEAVER_DIED, () => {
        const weaverNode = this.context.visualRegistry.getTransformNode(this.context.refs.weaver);
        if (weaverNode) {
          const sceneObj = this.context.visualRegistry.getScene();
          if (sceneObj) {
            this.spawnDeathDebris(weaverNode.position, sceneObj);
          }
          weaverNode.setEnabled(false);
        }
      })
    );

    this.unsubscribes.push(
      this.context.broker.subscribe(GameEvent.GAME_RESET, () => {
        this.clearDebris();
        const weaverNode = this.context.visualRegistry.getTransformNode(this.context.refs.weaver);
        if (weaverNode) {
          weaverNode.setEnabled(true);
        }
      })
    );
  }

  private registerDebrisShard(
    mesh: BABYLON.Mesh,
    pos: BABYLON.Vector3,
    centroid: BABYLON.Vector3,
    outward: BABYLON.Vector3,
    activeMat: BABYLON.Material,
    speedMult: number,
    lifeMult: number
  ): void {
    const config = VISUAL_JUICE_CONFIG.PARTICLES.DEBRIS;

    mesh.rotationQuaternion = null;
    mesh.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );

    mesh.position = pos.add(centroid).add(outward.scale(0.35));
    mesh.material = activeMat;

    this.context.visualRegistry.registerShadowCaster(mesh);

    const speed =
      config.VELOCITY_Y_MIN +
      Math.random() * (config.VELOCITY_Y_MAX - config.VELOCITY_Y_MIN) * speedMult;
    const vx = outward.x * speed + (Math.random() - 0.5) * 8.0;
    const vy = outward.y * speed + (Math.random() - 0.5) * 8.0;
    const vz = (Math.random() - 0.5) * 1.5;

    const rotVelX = (Math.random() - 0.5) * config.ANGULAR_MAX;
    const rotVelY = (Math.random() - 0.5) * config.ANGULAR_MAX;
    const rotVelZ = (Math.random() - 0.5) * config.ANGULAR_MAX;

    this.activeDebrisList.push({
      mesh,
      body: null,
      velocity: new BABYLON.Vector3(vx, vy, vz),
      angularVelocity: new BABYLON.Vector3(rotVelX, rotVelY, rotVelZ),
      lifeRemaining: config.LIFE * lifeMult
    });
  }

  private spawnDeathDebris(pos: BABYLON.Vector3, scene: BABYLON.Scene): void {
    const weaverNode = this.context.visualRegistry.getTransformNode(this.context.refs.weaver);
    const weaverMesh = weaverNode instanceof BABYLON.Mesh ? weaverNode : null;
    const activeMat = (weaverMesh?.material || this.debrisMat!) as BABYLON.Material;

    const radius = ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
    const proxyShell = BABYLON.MeshBuilder.CreateIcoSphere(
      "shellProxy",
      { radius: radius * 1.05, subdivisions: 0 },
      scene
    );

    const positions = proxyShell.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    if (positions) {
      const rLimit = radius * 1.05;
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];
        if (y < 0) {
          const r_sphere = Math.sqrt(rLimit * rLimit - y * y);
          if (r_sphere > 0.001) {
            const r_cone = rLimit * (1.0 + y / rLimit);
            const scaleFactor = r_cone / r_sphere;
            positions[i] = x * scaleFactor;
            positions[i + 2] = z * scaleFactor;
          } else {
            positions[i] = 0;
            positions[i + 2] = 0;
          }
        }
      }
      proxyShell.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    }
    const shellPos = proxyShell.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const shellInd = proxyShell.getIndices();

    if (shellPos && shellInd) {
      for (let i = 0; i < shellInd.length; i += 3) {
        const i1 = shellInd[i],
          i2 = shellInd[i + 1],
          i3 = shellInd[i + 2];
        const p1 = new BABYLON.Vector3(
          shellPos[i1 * 3],
          shellPos[i1 * 3 + 1],
          shellPos[i1 * 3 + 2]
        );
        const p2 = new BABYLON.Vector3(
          shellPos[i2 * 3],
          shellPos[i2 * 3 + 1],
          shellPos[i2 * 3 + 2]
        );
        const p3 = new BABYLON.Vector3(
          shellPos[i3 * 3],
          shellPos[i3 * 3 + 1],
          shellPos[i3 * 3 + 2]
        );
        const centroid = p1
          .add(p2)
          .add(p3)
          .scale(1 / 3);
        const outward = centroid.clone().normalize();

        const customMesh = new BABYLON.Mesh("shard_" + i, scene);
        const vertexData = new BABYLON.VertexData();
        vertexData.positions = [
          p1.x - centroid.x,
          p1.y - centroid.y,
          p1.z - centroid.z,
          p2.x - centroid.x,
          p2.y - centroid.y,
          p2.z - centroid.z,
          p3.x - centroid.x,
          p3.y - centroid.y,
          p3.z - centroid.z
        ];
        vertexData.indices = [0, 1, 2];

        vertexData.applyToMesh(customMesh);
        customMesh.convertToFlatShadedMesh();

        this.registerDebrisShard(
          customMesh,
          pos,
          centroid,
          outward,
          activeMat,
          1.5,
          0.8 + Math.random() * 0.4
        );
      }
    }
    proxyShell.dispose();

    const coreRadius = ARENA_CONFIG.ENTITY.WEAVER_RADIUS * 0.75;
    const directions = [
      [-1, -1, -1],
      [1, -1, -1],
      [-1, 1, -1],
      [1, 1, -1],
      [-1, -1, 1],
      [1, -1, 1],
      [-1, 1, 1],
      [1, 1, 1]
    ];

    for (let b = 0; b < directions.length; b++) {
      const dirX = directions[b][0];
      const dirY = directions[b][1];
      const dirZ = directions[b][2];

      const v0 = new BABYLON.Vector3(0, 0, 0);
      const v1 = new BABYLON.Vector3(dirX * coreRadius, 0, 0);
      const v2 = new BABYLON.Vector3(0, dirY * coreRadius, 0);
      const v3 = new BABYLON.Vector3(0, 0, dirZ * coreRadius);

      const centroid = v0
        .add(v1)
        .add(v2)
        .add(v3)
        .scale(1 / 4);
      const outward = centroid.clone().normalize();

      const localV0 = v0.subtract(centroid);
      const localV1 = v1.subtract(centroid);
      const localV2 = v2.subtract(centroid);
      const localV3 = v3.subtract(centroid);

      const localPositions = [
        localV0.x,
        localV0.y,
        localV0.z,
        localV1.x,
        localV1.y,
        localV1.z,
        localV2.x,
        localV2.y,
        localV2.z,
        localV3.x,
        localV3.y,
        localV3.z
      ];

      const vertices = [localV0, localV1, localV2, localV3];
      const faces = [
        [0, 1, 2],
        [0, 2, 3],
        [0, 3, 1],
        [1, 3, 2]
      ];

      const localIndices: number[] = [];
      const localCentroid = localV0
        .add(localV1)
        .add(localV2)
        .add(localV3)
        .scale(1 / 4);

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

        const faceCenter = a
          .add(b)
          .add(c)
          .scale(1 / 3);
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

      this.registerDebrisShard(
        customMesh,
        pos,
        centroid,
        outward,
        activeMat,
        0.8,
        0.9 + Math.random() * 0.3
      );
    }
  }

  public update(dt: number): void {
    const config = VISUAL_JUICE_CONFIG.PARTICLES.DEBRIS;
    const wallLimit = ARENA_CONFIG.HORIZONTAL.WALL_LIMIT_X;
    const playerNode = this.context.visualRegistry.getTransformNode(this.context.refs.player);

    const scene = this.context.visualRegistry.getScene();
    const defaultCameraY = POST_PROCESSING_PRESETS.CAMERA.DEFAULT_TARGET.y;
    const cameraYOffset =
      scene && scene.activeCamera ? scene.activeCamera.position.y - defaultCameraY : 0.0;
    const disposeThreshold = -16.0 + cameraYOffset;

    for (let i = this.activeDebrisList.length - 1; i >= 0; i--) {
      const d = this.activeDebrisList[i];
      d.lifeRemaining -= dt;

      if (d.lifeRemaining <= 0 || d.mesh.position.y < disposeThreshold) {
        if (d.body) {
          if (d.body.shape) d.body.shape.dispose();
          d.body.dispose();
        }
        d.mesh.dispose();
        this.activeDebrisList.splice(i, 1);
      } else {
        if (d.lifeRemaining < config.SCALE_DECAY_TIME) {
          const ratio = d.lifeRemaining / config.SCALE_DECAY_TIME;
          d.mesh.scaling.set(ratio, ratio, ratio);
        }

        if (!d.body) {
          d.velocity.y += CANONICAL_UNITS.GRAVITY.PLAYER_KINEMATIC * dt * 1.6;

          const debrisDrag = Math.pow(0.95, dt * 60.0);
          d.velocity.x *= debrisDrag;
          d.velocity.z *= debrisDrag;

          d.mesh.position.x += d.velocity.x * dt;
          d.mesh.position.y += d.velocity.y * dt;
          d.mesh.position.z += d.velocity.z * dt;

          d.mesh.rotation.x += d.angularVelocity.x * dt;
          d.mesh.rotation.y += d.angularVelocity.y * dt;
          d.mesh.rotation.z += d.angularVelocity.z * dt;

          if (d.mesh.position.x < -wallLimit) {
            d.mesh.position.x = -wallLimit;
            d.velocity.x *= -0.65;
            d.angularVelocity.y += (Math.random() - 0.5) * 6.0;
          } else if (d.mesh.position.x > wallLimit) {
            d.mesh.position.x = wallLimit;
            d.velocity.x *= -0.65;
            d.angularVelocity.y += (Math.random() - 0.5) * 6.0;
          }

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

          for (let j = i - 1; j >= 0; j--) {
            const d2 = this.activeDebrisList[j];
            if (d2.body) continue;
            const dx = d2.mesh.position.x - d.mesh.position.x;
            const dy = d2.mesh.position.y - d.mesh.position.y;
            const distSq = dx * dx + dy * dy;

            const isPyramid1 = d.mesh.name.includes("core_shard");
            const isPyramid2 = d2.mesh.name.includes("core_shard");
            const r1 = isPyramid1 ? 0.6 : 0.16;
            const r2 = isPyramid2 ? 0.6 : 0.16;
            const minDist = r1 + r2;

            if (distSq < minDist * minDist) {
              const dist = Math.sqrt(distSq) || 0.1;
              const nx = dx / dist;
              const ny = dy / dist;

              const overlap = minDist - dist;
              d.mesh.position.x -= nx * overlap * 0.5;
              d.mesh.position.y -= ny * overlap * 0.5;
              d2.mesh.position.x += nx * overlap * 0.5;
              d2.mesh.position.y += ny * overlap * 0.5;

              const kx = d.velocity.x - d2.velocity.x;
              const ky = d.velocity.y - d2.velocity.y;
              const p = kx * nx + ky * ny;
              if (p > 0) {
                d.velocity.x -= nx * p * 0.8;
                d.velocity.y -= ny * p * 0.8;
                d2.velocity.x += nx * p * 0.8;
                d2.velocity.y += ny * p * 0.8;

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
      if (d.body) {
        if (d.body.shape) d.body.shape.dispose();
        d.body.dispose();
      }
      d.mesh.dispose();
    }
    this.activeDebrisList = [];
  }

  public dispose(): void {
    this.unsubscribes.forEach((unsub) => unsub());
    this.unsubscribes = [];
    this.clearDebris();
    if (this.debrisMat) {
      this.debrisMat.dispose();
      this.debrisMat = null;
    }
  }
}
