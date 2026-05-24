import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent, SilkComponent, TraversalStateComponent, WeaverAIComponent, HealthComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import * as BABYLON from "@babylonjs/core";

export class TransformSyncSystem implements ISystem {
readonly phase = SystemPhase.RenderSync;
private scratchPrevQuat = new BABYLON.Quaternion();
private scratchCurrQuat = new BABYLON.Quaternion();
private playerVisualRotation = new BABYLON.Quaternion();
private scratchTargetQuat = new BABYLON.Quaternion();
private scrollOffset    = 0.0;
private scrollSpeed     = 5.0;
private currentEmissiveR = 0.05;
private currentEmissiveG = 0.15;
private currentEmissiveB = 0.05;

constructor(
private refs: EntityRefs,
private transforms: ComponentStore<TransformComponent>,
private silks: ComponentStore<SilkComponent>,
private traversal: ComponentStore<TraversalStateComponent>,
private visualRegistry: IVisualRegistry,
private weaverAIs: ComponentStore<WeaverAIComponent>,
private healthStore: ComponentStore<HealthComponent>
) {}

public render(alpha: number): void {
this.scrollTicks();
this.syncTransforms(alpha);
}

private scrollTicks(): void {
const scene = this.visualRegistry.getScene();
if (!scene) return;

const wAI = this.weaverAIs.get(this.refs.weaver);
const wHealth = this.healthStore.get(this.refs.weaver);

let targetScrollSpeed = 5.0;
if (wHealth && wHealth.current <= 0) {
targetScrollSpeed = 0.0;
} else if (wAI) {
if (wAI.state === "DASHING" || wAI.state === "RETURNING" || wAI.state === "DEFEATED") {
targetScrollSpeed = 0.0;
} else if (wHealth && wHealth.current < wHealth.max * 0.5) {
targetScrollSpeed = 9.0;
}
}

this.scrollSpeed = BABYLON.Scalar.Lerp(this.scrollSpeed, targetScrollSpeed, 0.1);
const totalRange  = 140.0;
this.scrollOffset += this.scrollSpeed * (1 / 60);
if (this.scrollOffset > totalRange) {
this.scrollOffset -= totalRange;
}

const ticks = scene.meshes.filter(m => m.metadata?.type === "scrolling_tick");
for (const tick of ticks) {
let y = tick.metadata.initialY - this.scrollOffset;
while (y < -56.0) y += totalRange;
tick.position.y = y;
}
}

private syncTransforms(alpha: number): void {
const silk = this.silks.get(this.refs.player);
const trav   = this.traversal.get(this.refs.player);
const wAI    = this.weaverAIs.get(this.refs.weaver);

for (const [id, curr] of this.transforms.entries()) {
const node = this.visualRegistry.getTransformNode(id);
if (!node) continue;

node.position.x = curr.prevX + (curr.x - curr.prevX) * alpha;
node.position.y = curr.prevY + (curr.y - curr.prevY) * alpha;
node.position.z = curr.prevZ + (curr.z - curr.prevZ) * alpha;

if (id === this.refs.player) {
    let dx = 0;
    let dy = 1;

    if (silk && trav) {
        if (trav.state === "LAUNCHING") {
            const vx = silk.dynamicVelX;
            const vy = silk.dynamicVelY;
            if (vx * vx + vy * vy > 1.0) {
                dx = vx;
                dy = vy;
            }
        } else if (trav.state === "AIRBORNE") {
            const px = node.position.x;
            const py = node.position.y;
            dx = px - silk.anchorX;
            dy = py - silk.anchorY;
        }
    }

    const targetAngle = (dx !== 0 || dy !== 1) ? -Math.atan2(dx, dy) : 0;
    BABYLON.Quaternion.RotationAxisToRef(BABYLON.Axis.Z, targetAngle, this.scratchTargetQuat);

    if (!node.rotationQuaternion) {
        node.rotationQuaternion = new BABYLON.Quaternion();
    }

    BABYLON.Quaternion.SlerpToRef(
        this.playerVisualRotation,
        this.scratchTargetQuat,
        0.20,
        this.playerVisualRotation
    );
    node.rotationQuaternion.copyFrom(this.playerVisualRotation);

    const mesh = node as BABYLON.AbstractMesh;
    const mat  = mesh?.material as BABYLON.PBRMaterial | null;
    if (mat && silk && trav) {
        this.updatePlayerEmissive(mat, silk.tension, trav.state, alpha);
    }
} else if (id === this.refs.weaver && wAI) {
    this.scratchPrevQuat.set(curr.prevQx, curr.prevQy, curr.prevQz, curr.prevQw);
    this.scratchCurrQuat.set(curr.qx, curr.qy, curr.qz, curr.qw);

    if (!node.rotationQuaternion) {
        node.rotationQuaternion = new BABYLON.Quaternion();
    }
    BABYLON.Quaternion.SlerpToRef(
        this.scratchPrevQuat,
        this.scratchCurrQuat,
        alpha,
        node.rotationQuaternion
    );

    const mesh = node as BABYLON.AbstractMesh;
    const mat  = mesh?.material as BABYLON.PBRMaterial | null;
    if (mat) {
        const hex = wAI.hue.replace(String.fromCharCode(35), "");
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;
        const pulse = 0.05 + Math.sin(Date.now() * 0.01) * 0.04;
        const emissiveScale = 0.4;
        mat.emissiveColor.set(r * emissiveScale + pulse, g * emissiveScale, b * emissiveScale);
    }
} else {
    this.scratchPrevQuat.set(curr.prevQx, curr.prevQy, curr.prevQz, curr.prevQw);
    this.scratchCurrQuat.set(curr.qx, curr.qy, curr.qz, curr.qw);

    if (!node.rotationQuaternion) {
        node.rotationQuaternion = new BABYLON.Quaternion();
    }
    BABYLON.Quaternion.SlerpToRef(
        this.scratchPrevQuat,
        this.scratchCurrQuat,
        alpha,
        node.rotationQuaternion
    );
}
}
}

private updatePlayerEmissive(mat: BABYLON.PBRMaterial, tension: number, state: string, _alpha: number): void {
void _alpha;
let targetR: number;
let targetG: number;
let targetB: number;

if (state === "WALL_SLIDING") {
targetR = 0.1 + tension * 0.9;
targetG = 0.1 + (1.0 - tension) * 0.1;
targetB = 0.1 * (1.0 - tension);
} else if (state === "LAUNCHING") {
targetR = 0.9;
targetG = 0.9;
targetB = 0.9;
} else {
targetR = 0.05;
targetG = 0.05;
targetB = 0.05;
}

const lerpRate = 0.18;
this.currentEmissiveR += (targetR - this.currentEmissiveR) * lerpRate;
this.currentEmissiveG += (targetG - this.currentEmissiveG) * lerpRate;
this.currentEmissiveB += (targetB - this.currentEmissiveB) * lerpRate;
const emissiveScale = 0.2;
mat.emissiveColor.set(this.currentEmissiveR * emissiveScale, this.currentEmissiveG * emissiveScale, this.currentEmissiveB * emissiveScale);
}
}
