import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { KinematicVelocityComponent, WeaverTraversalComponent, TransformComponent, KinematicTargetComponent, WeaverAIComponent, HealthComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";

export class WeaverTraversalSystem implements ISystem {
readonly phase = SystemPhase.Kinematics;
private minX = -13.0;
private maxX = 13.0;

constructor(
private refs: EntityRefs,
private velocities: ComponentStore<KinematicVelocityComponent>,
private traversal: ComponentStore<WeaverTraversalComponent>,
private transforms: ComponentStore<TransformComponent>,
private targets: ComponentStore<KinematicTargetComponent>,
private aiStore: ComponentStore<WeaverAIComponent>,
private healths: ComponentStore<HealthComponent>
) {}

public update(dt: number): void {
const vel = this.velocities.get(this.refs.weaver);
const trav = this.traversal.get(this.refs.weaver);
const trans = this.transforms.get(this.refs.weaver);
const target = this.targets.get(this.refs.weaver);
const ai = this.aiStore.get(this.refs.weaver);
const health = this.healths.get(this.refs.weaver);

if (!vel || !trav || !trans || !target) return;

const isSweeping = !ai || ai.state === "SWEEPING";
if (isSweeping) {
let nextX = trans.x + vel.x * dt;
const isBerserk = health ? (health.current < health.max * 0.5) : false;
const sweepSpeed = isBerserk ? 9.0 : 4.5;
if (nextX >= this.maxX) {
nextX = this.maxX;
vel.x = -sweepSpeed;
} else if (nextX <= this.minX) {
nextX = this.minX;
vel.x = sweepSpeed;
}
target.x = nextX;
target.y = 34.0;
target.active = true;
trav.velX = vel.x;
trav.velY = 0;
} else {
target.x = trans.x + vel.x * dt;
target.y = trans.y + vel.y * dt;
target.active = true;
trav.velX = vel.x;
trav.velY = vel.y;
}

const wallLimit = 13.8;
if (target.x > wallLimit) {
target.x = wallLimit;
if (vel.x > 0) vel.x = 0;
} else if (target.x < -wallLimit) {
target.x = -wallLimit;
if (vel.x < 0) vel.x = 0;
}

const ceilingLimit = 38.0;
const floorLimit = -8.0;
if (target.y > ceilingLimit) {
target.y = ceilingLimit;
if (vel.y > 0) vel.y = 0;
trav.isGrounded = false;
trav.isWallClinging = false;
} else if (target.y < floorLimit) {
target.y = floorLimit;
if (vel.y < 0) vel.y = 0;
trav.isGrounded = true;
trav.isWallClinging = false;
} else {
trav.isGrounded = false;
const wallThreshold = 13.6;
if (Math.abs(target.x) >= wallThreshold) {
trav.isWallClinging = true;
trav.wallNormalX = target.x > 0 ? -1 : 1;
} else {
trav.isWallClinging = false;
trav.wallNormalX = 0;
}
}
}
}
