import { getWeaverStingerTip } from "../../core/utils/EngineUtils";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { TransformComponent, TetherComponent } from "../../core/ecs/Components";
import { SystemContext } from "../../core/engine/SystemContext";
import { VISUAL_JUICE_CONFIG, ARENA_CONFIG, GAMEPLAY_TUNING } from "../../core/engine/ArenaConfig";
import * as BABYLON from "@babylonjs/core";

export class TetherVisualizerSystem implements ISystem {
  readonly phase = SystemPhase.RenderSync;

  private readonly SEGMENTS = VISUAL_JUICE_CONFIG.TETHER_ROPE.SEGMENTS;
  private readonly MAX_SAG = VISUAL_JUICE_CONFIG.TETHER_ROPE.MAX_SAG;
  private readonly BASE_RADIUS = VISUAL_JUICE_CONFIG.TETHER_ROPE.BASE_RADIUS;
  private readonly MAX_RADIUS = VISUAL_JUICE_CONFIG.TETHER_ROPE.MAX_RADIUS;

  private tetherMesh: BABYLON.Mesh | null = null;
  private tetherMeshAnchor: BABYLON.Mesh | null = null;
  private tetherMeshPlayer: BABYLON.Mesh | null = null;
  private tetherMat: BABYLON.PBRMaterial | null = null;

  private points: BABYLON.Vector3[] = [];
  private pointsAnchor: BABYLON.Vector3[] = [];
  private pointsPlayer: BABYLON.Vector3[] = [];

  private scratchAnchor = new BABYLON.Vector3();
  private scratchPlayer = new BABYLON.Vector3();
  private scratchCtrl = new BABYLON.Vector3();
  private _localHeadTop = new BABYLON.Vector3();

  private isSnapped = false;
  private snapTimer = 0.0;
  private readonly maxSnapDuration = VISUAL_JUICE_CONFIG.TETHER_ROPE.MAX_SNAP_DURATION_SECONDS;

  constructor(private context: SystemContext) {
    for (let i = 0; i <= this.SEGMENTS; i++) {
      this.points.push(new BABYLON.Vector3(0, 0, 0));
    }
    for (let i = 0; i <= 12; i++) {
      this.pointsAnchor.push(new BABYLON.Vector3(0, 0, 0));
      this.pointsPlayer.push(new BABYLON.Vector3(0, 0, 0));
    }
  }

  public init(): void {
    const scene = this.context.visualQuery.getScene();
    if (!scene) return;

    this.tetherMat = new BABYLON.PBRMaterial("tetherMat", scene);
    this.tetherMat.metallic = 0.95;
    this.tetherMat.roughness = 0.05;
    this.tetherMat.sheen.isEnabled = true;
    this.tetherMat.sheen.intensity = 0.95;
    this.tetherMat.sheen.roughness = 0.05;
    this.tetherMat.emissiveIntensity = 4.0;
    this.tetherMat.albedoColor = new BABYLON.Color3(1.0, 1.0, 1.0);
    this.tetherMat.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    this.tetherMat.disableLighting = false;

    this.tetherMesh = BABYLON.MeshBuilder.CreateTube(
      "tetherTube",
      {
        path: this.points,
        radius: this.BASE_RADIUS,
        tessellation: 8,
        cap: BABYLON.Mesh.NO_CAP,
        updatable: true
      },
      scene
    );
    this.tetherMesh.material = this.tetherMat;

    this.tetherMeshAnchor = BABYLON.MeshBuilder.CreateTube(
      "tetherTubeAnchor",
      {
        path: this.pointsAnchor,
        radius: this.BASE_RADIUS,
        tessellation: 8,
        cap: BABYLON.Mesh.NO_CAP,
        updatable: true
      },
      scene
    );
    this.tetherMeshAnchor.material = this.tetherMat;
    this.tetherMeshAnchor.setEnabled(false);

    this.tetherMeshPlayer = BABYLON.MeshBuilder.CreateTube(
      "tetherTubePlayer",
      {
        path: this.pointsPlayer,
        radius: this.BASE_RADIUS,
        tessellation: 8,
        cap: BABYLON.Mesh.NO_CAP,
        updatable: true
      },
      scene
    );
    this.tetherMeshPlayer.material = this.tetherMat;
    this.tetherMeshPlayer.setEnabled(false);
  }

  public update(dt: number): void {
    const tethers = this.context.stores.get<TetherComponent>("tether");
    const tether = tethers.get(this.context.refs.player);
    if (!tether) return;

    if (!tether.isAttached) {
      if (!this.isSnapped) {
        this.isSnapped = true;
        this.snapTimer = 0.0;
      }
      this.snapTimer = Math.min(this.maxSnapDuration, this.snapTimer + dt);
    } else {
      this.isSnapped = false;
      this.snapTimer = 0.0;
    }
  }

  public render(alpha: number): void {
    if (!this.tetherMesh || !this.tetherMat || !this.tetherMeshAnchor || !this.tetherMeshPlayer)
      return;

    const transforms = this.context.stores.get<TransformComponent>("transform");
    const tethers = this.context.stores.get<TetherComponent>("tether");

    const pTrans = transforms.get(this.context.refs.player);
    const tether = tethers.get(this.context.refs.player);
    if (!pTrans || !tether) return;

    const pNode = this.context.visualQuery.getTransformNode(this.context.refs.player);

    if (tether.isAttached) {
      this.tetherMesh.setEnabled(true);
      this.tetherMeshAnchor.setEnabled(false);
      this.tetherMeshPlayer.setEnabled(false);

      if (pNode) {
        const height = ARENA_CONFIG.ENTITY.PLAYER_HEIGHT;
        this._localHeadTop.set(0, height / 2, 0);
        BABYLON.Vector3.TransformCoordinatesToRef(
          this._localHeadTop,
          pNode.getWorldMatrix(),
          this.scratchPlayer
        );
      } else {
        const px = pTrans.prevX + (pTrans.x - pTrans.prevX) * alpha;
        const py = pTrans.prevY + (pTrans.y - pTrans.prevY) * alpha;
        this.scratchPlayer.set(px, py, 0);
      }

      const wNode = this.context.visualQuery.getTransformNode(
        this.context.refs.weaver
      ) as BABYLON.Mesh | null;
      if (wNode) {
        const radius = ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
        const rot = wNode.rotationQuaternion || BABYLON.Quaternion.FromEulerVector(wNode.rotation);
        const tip = getWeaverStingerTip(
          wNode.position.x,
          wNode.position.y,
          wNode.position.z,
          rot.x,
          rot.y,
          rot.z,
          rot.w,
          radius,
          1.0
        );
        this.scratchAnchor.copyFrom(tip);
      } else {
        this.scratchAnchor.set(tether.anchorX, tether.anchorY, tether.anchorZ);
      }

      const tension = Math.max(0, Math.min(1.0, tether.tension));
      const reelConfig = GAMEPLAY_TUNING.REEL;
      const isSweetSpot =
        tension >= reelConfig.SWEET_SPOT_MIN && tension <= reelConfig.SWEET_SPOT_MAX;

      const timeMs = performance.now();
      const frequency = VISUAL_JUICE_CONFIG.TETHER_ROPE.TENSION_VIB_FREQ;
      const vibPhase = timeMs * frequency;

      let vibAmp = 0;
      if (tension >= 0.95) {
        vibAmp = (tension - 1.0) * VISUAL_JUICE_CONFIG.TETHER_ROPE.TENSION_VIB_AMP * 2.5;
      } else if (tension > VISUAL_JUICE_CONFIG.TETHER_ROPE.TENSION_VIB_THRESHOLD) {
        vibAmp =
          (tension - VISUAL_JUICE_CONFIG.TETHER_ROPE.TENSION_VIB_THRESHOLD) *
          VISUAL_JUICE_CONFIG.TETHER_ROPE.TENSION_VIB_AMP;
      }

      const vibOffset = Math.sin(vibPhase * (tension >= 0.95 ? 3.5 : 1.0)) * vibAmp;

      const midX = (this.scratchAnchor.x + this.scratchPlayer.x) * 0.5;
      const midY = (this.scratchAnchor.y + this.scratchPlayer.y) * 0.5;

      let MathSag = this.MAX_SAG * (1.0 - Math.min(1.0, tension)) + vibOffset;
      if (tension < 0.4) {
        MathSag *= 1.3;
      } else if (isSweetSpot) {
        MathSag *= 0.15;
      }

      if (tether.reelVelocity < 0) {
        MathSag *= Math.max(0.15, 1.0 - Math.abs(tether.reelVelocity) / reelConfig.IN_SPEED);
      } else if (tether.reelVelocity > 0) {
        MathSag *= 1.0 + (tether.reelVelocity / reelConfig.OUT_SPEED) * 0.4;
      }

      this.scratchCtrl.set(midX, midY - MathSag, VISUAL_JUICE_CONFIG.TETHER_ROPE.BEZIER_DEPTH);

      let reelPhaseOffset = 0;
      if (tether.reelVelocity !== 0) {
        reelPhaseOffset = timeMs * 0.02 * Math.sign(tether.reelVelocity);
      }

      for (let i = 0; i <= this.SEGMENTS; i++) {
        const t = i / this.SEGMENTS;
        const t1 = 1 - t;
        const pt = this.points[i];
        pt.x =
          t1 * t1 * this.scratchAnchor.x +
          2 * t1 * t * this.scratchCtrl.x +
          t * t * this.scratchPlayer.x;
        pt.y =
          t1 * t1 * this.scratchAnchor.y +
          2 * t1 * t * this.scratchCtrl.y +
          t * t * this.scratchPlayer.y;
        pt.z =
          t1 * t1 * this.scratchAnchor.z +
          2 * t1 * t * this.scratchCtrl.z +
          t * t * this.scratchPlayer.z;

        const baseWave = Math.sin(
          (i / this.SEGMENTS) * Math.PI * VISUAL_JUICE_CONFIG.TETHER_ROPE.WAVINESS_STRETCH +
            timeMs * VISUAL_JUICE_CONFIG.TETHER_ROPE.WAVINESS_FREQ +
            reelPhaseOffset
        );

        let waveAmp = VISUAL_JUICE_CONFIG.TETHER_ROPE.WAVINESS_AMP;
        if (tension < 0.4) {
          waveAmp *= 1.8;
        } else if (isSweetSpot) {
          waveAmp *= 0.35;
        } else if (tension >= 0.95) {
          waveAmp *= 0.1;
          pt.x += (Math.random() - 0.5) * 0.08;
          pt.y += (Math.random() - 0.5) * 0.08;
        }

        pt.z += baseWave * waveAmp;
      }

      let radius = this.BASE_RADIUS + Math.min(1.0, tension) * (this.MAX_RADIUS - this.BASE_RADIUS);
      if (tension < 0.4) {
        radius *= 0.85;
      } else if (isSweetSpot) {
        const pulse = Math.sin(timeMs * 0.03) * 0.015;
        radius = this.MAX_RADIUS * 1.1 + pulse;
      }

      this.tetherMesh = BABYLON.MeshBuilder.CreateTube("tetherTube", {
        path: this.points,
        radius: radius,
        tessellation: 8,
        cap: BABYLON.Mesh.NO_CAP,
        instance: this.tetherMesh
      });

      let r: number;
      let g: number;
      let b: number;
      let eBrightness: number;

      if (tension >= 0.85) {
        r = 1.0;
        g = 0.0;
        b = 0.15;
        eBrightness = 4.2;
      } else if (isSweetSpot) {
        r = VISUAL_JUICE_CONFIG.TETHER_ROPE.SWEET_SPOT_CORE_COLOR.r;
        g = VISUAL_JUICE_CONFIG.TETHER_ROPE.SWEET_SPOT_CORE_COLOR.g;
        b = VISUAL_JUICE_CONFIG.TETHER_ROPE.SWEET_SPOT_CORE_COLOR.b;
        eBrightness = 5.5;
      } else if (tension >= 0.4) {
        const ratio = (tension - 0.4) / 0.15;
        r = 1.0;
        g = 0.75 + ratio * 0.25;
        b = 1.0 - ratio;
        eBrightness = 0.4 + ratio * 1.5;
      } else {
        r = 0.82;
        g = 0.82;
        b = 0.86;
        eBrightness = 0.15;
      }

      this.tetherMat.albedoColor.set(r, g, b);

      let finalBrightness = eBrightness + tether.reelHeat * 0.45;
      if (isSweetSpot) {
        finalBrightness *= 2.5;
      }

      this.tetherMat.emissiveColor.set(
        finalBrightness * r,
        finalBrightness * g,
        finalBrightness * b
      );
    } else {
      this.tetherMesh.setEnabled(false);

      if (this.snapTimer >= this.maxSnapDuration) {
        this.tetherMeshAnchor.setEnabled(false);
        this.tetherMeshPlayer.setEnabled(false);
        return;
      }

      this.tetherMeshAnchor.setEnabled(true);
      this.tetherMeshPlayer.setEnabled(true);

      const T = this.snapTimer / this.maxSnapDuration;

      if (pNode) {
        const height = ARENA_CONFIG.ENTITY.PLAYER_HEIGHT;
        const localHeadTop = new BABYLON.Vector3(0, height / 2, 0);
        BABYLON.Vector3.TransformCoordinatesToRef(
          localHeadTop,
          pNode.getWorldMatrix(),
          this.scratchPlayer
        );
      } else {
        const px = pTrans.prevX + (pTrans.x - pTrans.prevX) * alpha;
        const py = pTrans.prevY + (pTrans.y - pTrans.prevY) * alpha;
        this.scratchPlayer.set(px, py, 0);
      }

      const wNode = this.context.visualQuery.getTransformNode(
        this.context.refs.weaver
      ) as BABYLON.Mesh | null;
      if (wNode) {
        const radius = ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
        const rot = wNode.rotationQuaternion || BABYLON.Quaternion.FromEulerVector(wNode.rotation);
        const tip = getWeaverStingerTip(
          wNode.position.x,
          wNode.position.y,
          wNode.position.z,
          rot.x,
          rot.y,
          rot.z,
          rot.w,
          radius,
          1.0
        );
        this.scratchAnchor.copyFrom(tip);
      } else {
        this.scratchAnchor.set(tether.anchorX, tether.anchorY, tether.anchorZ);
      }

      const midX = (this.scratchAnchor.x + this.scratchPlayer.x) * 0.5;
      const midY = (this.scratchAnchor.y + this.scratchPlayer.y) * 0.5;
      const MathSag = this.MAX_SAG * (1.0 - tether.tension);
      this.scratchCtrl.set(midX, midY - MathSag, VISUAL_JUICE_CONFIG.TETHER_ROPE.BEZIER_DEPTH);

      const maxAnchorT = (1 - T) * 0.5;
      const whipOffset = Math.sin(T * Math.PI * 5) * (1 - T) * 1.8;

      for (let i = 0; i <= 12; i++) {
        const subT = (i / 12) * maxAnchorT;
        const t1 = 1 - subT;
        const pt = this.pointsAnchor[i];
        pt.x =
          t1 * t1 * this.scratchAnchor.x +
          2 * t1 * subT * this.scratchCtrl.x +
          subT * subT * this.scratchPlayer.x;
        pt.y =
          t1 * t1 * this.scratchAnchor.y +
          2 * t1 * subT * this.scratchCtrl.y +
          subT * subT * this.scratchPlayer.y;
        pt.z =
          t1 * t1 * this.scratchAnchor.z +
          2 * t1 * subT * this.scratchCtrl.z +
          subT * subT * this.scratchPlayer.z;

        const endWeight = i / 12;
        pt.x += whipOffset * endWeight;
        pt.y += Math.abs(whipOffset) * 0.4 * endWeight;
      }

      const minPlayerT = 0.5 + T * 0.5;
      const playerWhip = Math.sin(T * Math.PI * 5 + Math.PI) * (1 - T) * 1.8;
      const gravityDrop = T * T * -9.81 * 0.8;

      for (let i = 0; i <= 12; i++) {
        const subT = minPlayerT + (i / 12) * (1.0 - minPlayerT);
        const t1 = 1 - subT;
        const pt = this.pointsPlayer[i];
        pt.x =
          t1 * t1 * this.scratchAnchor.x +
          2 * t1 * subT * this.scratchCtrl.x +
          subT * subT * this.scratchPlayer.x;
        pt.y =
          t1 * t1 * this.scratchAnchor.y +
          2 * t1 * subT * this.scratchCtrl.y +
          subT * subT * this.scratchPlayer.y;
        pt.z =
          t1 * t1 * this.scratchAnchor.z +
          2 * t1 * subT * this.scratchCtrl.z +
          subT * subT * this.scratchPlayer.z;

        const endWeight = 1.0 - i / 12;
        pt.x += playerWhip * endWeight;
        pt.y += (playerWhip * 0.4 + gravityDrop) * endWeight;
      }

      const radius = this.BASE_RADIUS * (1 - T);
      if (radius > 0.01) {
        this.tetherMeshAnchor = BABYLON.MeshBuilder.CreateTube("tetherTubeAnchor", {
          path: this.pointsAnchor,
          radius: radius,
          tessellation: 8,
          cap: BABYLON.Mesh.NO_CAP,
          instance: this.tetherMeshAnchor
        });
        this.tetherMeshPlayer = BABYLON.MeshBuilder.CreateTube("tetherTubePlayer", {
          path: this.pointsPlayer,
          radius: radius,
          tessellation: 8,
          cap: BABYLON.Mesh.NO_CAP,
          instance: this.tetherMeshPlayer
        });
      } else {
        this.tetherMeshAnchor.setEnabled(false);
        this.tetherMeshPlayer.setEnabled(false);
      }
    }
  }

  public dispose(): void {
    if (this.tetherMesh) this.tetherMesh.dispose();
    if (this.tetherMeshAnchor) this.tetherMeshAnchor.dispose();
    if (this.tetherMeshPlayer) this.tetherMeshPlayer.dispose();
    if (this.tetherMat) this.tetherMat.dispose();
  }
}
