import { IWeaverState, AIContext, WeaverStateType } from "./IWeaverState";
import { GameEvent } from "../../core/events/GameEvents";

const HASH = String.fromCharCode(35);

export class WeaverSweepingState implements IWeaverState {
public readonly type: WeaverStateType = "SWEEPING";
public readonly name = "SWEEPING CEILING";
public readonly hue = HASH + "ef4444";
private shootTimer = 0.0;
private hasTelegraphed = false;

public enter(ctx: AIContext): void {
this.shootTimer = 0.0;
this.hasTelegraphed = false;
ctx.ai.timeInState = 0;
ctx.ai.hue = this.hue;
const health = ctx.healths.get(ctx.weaverId);
const isBerserk = health ? (health.current < health.max * 0.5) : false;
const patrolSpeed = isBerserk ? 9.0 : 4.5;
ctx.commands.dispatch({
type: "SET_KINEMATIC_VELOCITY",
entityId: ctx.weaverId,
x: patrolSpeed, y: 0, z: 0
});
}

public exit(): void {}

public update(ctx: AIContext, dt: number): WeaverStateType | null {
ctx.ai.timeInState += dt;
this.shootTimer += dt;
const telegraphThreshold = 1.8;
if (this.shootTimer >= telegraphThreshold && !this.hasTelegraphed) {
this.hasTelegraphed = true;
ctx.ai.hue = HASH + "eab308";
ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.12, duration: 0.15 });
}
if (this.shootTimer >= 2.4) {
this.shootTimer = 0.0;
this.hasTelegraphed = false;
ctx.ai.hue = this.hue;
const playerTrans = ctx.transforms.get(ctx.playerId);
const wTrans = ctx.transforms.get(ctx.weaverId);
if (playerTrans && wTrans) {
ctx.broker.publish(GameEvent.WEAVER_SHOOT, {
x: wTrans.x,
y: wTrans.y - 1.8,
tx: playerTrans.x,
ty: playerTrans.y
});
}
}
return null;
}
}

export class WeaverDashingState implements IWeaverState {
public readonly type: WeaverStateType = "DASHING";
public readonly name = "WEAVER DASH";
public readonly hue = HASH + "f59e0b";
private dashCount = 0;
private maxDashes = 2;
private currentPhase: "PREP" | "THRUST" | "RECOVER" = "PREP";
private phaseTimer = 0.0;
private targetPos = { x: 0, y: 0 };
private thrustVelocity = { x: 0, y: 0 };

public enter(ctx: AIContext): void {
const health = ctx.healths.get(ctx.weaverId);
const isBerserk = health ? (health.current < health.max * 0.5) : false;
this.dashCount = 0;
this.maxDashes = isBerserk ? 3 : 2;
this.startPrep(ctx);
}

public exit(): void {}

private startPrep(ctx: AIContext): void {
this.currentPhase = "PREP";
this.phaseTimer = 0.6;
ctx.ai.hue = HASH + "eab308";
ctx.commands.dispatch({
type: "SET_KINEMATIC_VELOCITY",
entityId: ctx.weaverId,
x: 0, y: 0, z: 0
});
const playerTrans = ctx.transforms.get(ctx.playerId);
if (playerTrans) {
this.targetPos.x = playerTrans.x;
this.targetPos.y = playerTrans.y;
} else {
this.targetPos.x = 0;
this.targetPos.y = 14;
}
}

private startThrust(ctx: AIContext): void {
this.currentPhase = "THRUST";
this.phaseTimer = 0.8;
ctx.ai.hue = HASH + "ef4444";
const weaverTrans = ctx.transforms.get(ctx.weaverId);
if (weaverTrans) {
const dx = this.targetPos.x - weaverTrans.x;
const dy = this.targetPos.y - weaverTrans.y;
const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;
const speed = this.maxDashes === 3 ? 36.0 : 28.0;
this.thrustVelocity.x = (dx / dist) * speed;
this.thrustVelocity.y = (dy / dist) * speed;
ctx.commands.dispatch({
type: "SET_KINEMATIC_VELOCITY",
entityId: ctx.weaverId,
x: this.thrustVelocity.x,
y: this.thrustVelocity.y,
z: 0
});
}
}

private startRecover(ctx: AIContext): void {
this.currentPhase = "RECOVER";
this.phaseTimer = 0.5;
ctx.ai.hue = HASH + "a5f3fc";
ctx.commands.dispatch({
type: "SET_KINEMATIC_VELOCITY",
entityId: ctx.weaverId,
x: 0, y: 0, z: 0
});
ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.8, duration: 0.4 });
}

public update(ctx: AIContext, dt: number): WeaverStateType | null {
this.phaseTimer -= dt;
if (this.currentPhase === "PREP") {
const StrobeHz = 16.0;
const step = Math.floor(this.phaseTimer * StrobeHz);
ctx.ai.hue = step % 2 === 0 ? (HASH + "ef4444") : (HASH + "eab308");
if (Math.random() < 0.4) {
ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.08, duration: 0.05 });
}
if (this.phaseTimer <= 0) {
this.startThrust(ctx);
}
} else if (this.currentPhase === "THRUST") {
const trav = ctx.weaverTraversal.get(ctx.weaverId);
const hitWallOrGround = trav ? (trav.isWallClinging || trav.isGrounded) : false;
if (this.phaseTimer <= 0 || hitWallOrGround) {
this.startRecover(ctx);
}
} else if (this.currentPhase === "RECOVER") {
if (this.phaseTimer <= 0) {
this.dashCount++;
if (this.dashCount >= this.maxDashes) {
return "RETURNING";
} else {
this.startPrep(ctx);
}
}
}
return null;
}
}

export class WeaverReturningState implements IWeaverState {
public readonly type: WeaverStateType = "RETURNING";
public readonly name = "RETURNING TO CEILING";
public readonly hue = HASH + "4b5563";

public enter(ctx: AIContext): void {
ctx.ai.timeInState = 0;
ctx.ai.hue = this.hue;
}

public exit(): void {}

public update(ctx: AIContext, dt: number): WeaverStateType | null {
ctx.ai.timeInState += dt;
const wTrans = ctx.transforms.get(ctx.weaverId);
if (wTrans) {
const targetY = 28.0;
const dy = targetY - wTrans.y;
if (Math.abs(dy) < 0.3) {
return "SWEEPING";
}
const speed = 12.0;
ctx.commands.dispatch({
type: "SET_KINEMATIC_VELOCITY",
entityId: ctx.weaverId,
x: 0,
y: speed,
z: 0
});
}
return null;
}
}

export class WeaverDefeatedState implements IWeaverState {
public readonly type: WeaverStateType = "DEFEATED";
public readonly name = "WEAVER DEFEATED";
public readonly hue = HASH + "111317";

public enter(ctx: AIContext): void {
ctx.ai.timeInState = 0;
ctx.ai.hue = this.hue;
ctx.commands.dispatch({
type: "SET_KINEMATIC_VELOCITY",
entityId: ctx.weaverId,
x: 0, y: 0, z: 0
});
ctx.broker.publish(GameEvent.WEAVER_DIED, undefined);
ctx.broker.publish(GameEvent.GAME_WIN, undefined);
ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 1.5, duration: 1.0 });
}

public exit(): void {}

public update(): WeaverStateType | null {
return null;
}
}
