import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
    TetherComponent,
    KinematicTargetComponent,
    TraversalStateComponent,
    TransformComponent,
    InputIntentComponent
} from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";

export class PlayerKinematicsSystem implements ISystem {
    readonly phase = SystemPhase.Kinematics;

    private readonly GRAVITY             = -24.0;
    private readonly SWING_STEER_FORCE   = 32.0;
    private readonly LAUNCH_STEER_FORCE   = 16.0;
    private readonly BASE_ROPE_LENGTH    = 12.0;
    private readonly MAX_ROPE_LENGTH     = 24.0;
    private readonly WALL_LIMIT_X        = 14.2;
    private readonly WALL_SLIDE_SPEED    = -3.0;
    private readonly DRAG_DAMPING        = 0.99;

    private readonly TENSION_CHARGE_RATE = 0.65;
    private readonly MIN_FLING_TENSION   = 0.06;

    private readonly FLING_IMPULSE       = 54.0;
    private readonly LAUNCH_DURATION     = 0.70;
    private readonly LAUNCH_GRAVITY_MULT = 0.22;

    private lastTraversalState: string = "";

    constructor(
        private refs: EntityRefs,
        private tethers: ComponentStore<TetherComponent>,
        private targets: ComponentStore<KinematicTargetComponent>,
        private traversal: ComponentStore<TraversalStateComponent>,
        private transforms: ComponentStore<TransformComponent>,
        private inputs: ComponentStore<InputIntentComponent>,
        private broker: EventBroker
    ) {}

    public update(dt: number): void {
        const tether = this.tethers.get(this.refs.player);
        const target  = this.targets.get(this.refs.player);
        const trav    = this.traversal.get(this.refs.player);
        const sTrans  = this.transforms.get(this.refs.spider);
        const input   = this.inputs.get(this.refs.player);

        if (!tether || !target || !trav || !sTrans || !input) return;

        tether.anchorX = sTrans.x;
        tether.anchorY = sTrans.y;
        tether.anchorZ = sTrans.z;

        if (trav.state === "LAUNCHING") {
            this.stepLaunching(dt, tether, target, trav, input);
        } else {
            this.stepPhysics(dt, tether, trav, input);

            const nextX = target.x + tether.dynamicVelX * dt;
            const nextY = target.y + tether.dynamicVelY * dt;

            this.resolveWallContact(nextX, nextY, dt, target, tether, trav, input);

            if (trav.state === "AIRBORNE") {
                this.enforceRopeConstraint(target, tether);
            }
        }

        const dx = target.x - tether.anchorX;
        const dy = target.y - tether.anchorY;
        tether.currentLength = Math.sqrt(dx * dx + dy * dy) || 1.0;

        this.broker.publish(GameEvent.ROPE_TENSION_CHANGE, { tension: tether.tension });

        if (trav.state !== this.lastTraversalState) {
            this.lastTraversalState = trav.state;
            this.broker.publish(GameEvent.PLAYER_STATE_CHANGE, { state: trav.state });
        }
    }

    private stepPhysics(
        dt: number,
        tether: TetherComponent,
        trav: TraversalStateComponent,
        input: InputIntentComponent
    ): void {
        tether.dynamicVelY += this.GRAVITY * dt;

        if (trav.state === "AIRBORNE") {
            tether.dynamicVelX += input.x * this.SWING_STEER_FORCE * dt;
        }

        const damp = Math.pow(this.DRAG_DAMPING, dt * 60);
        tether.dynamicVelX *= damp;
        tether.dynamicVelY *= damp;
    }

    private stepLaunching(
        dt: number,
        tether: TetherComponent,
        target: KinematicTargetComponent,
        trav: TraversalStateComponent,
        input: InputIntentComponent
    ): void {
        trav.launchTimer -= dt;

        tether.dynamicVelX += input.x * this.LAUNCH_STEER_FORCE * dt;
        tether.dynamicVelY += this.GRAVITY * this.LAUNCH_GRAVITY_MULT * dt;

        const damp = Math.pow(this.DRAG_DAMPING, dt * 60);
        tether.dynamicVelX *= damp;
        tether.dynamicVelY *= damp;

        target.x += tether.dynamicVelX * dt;
        target.y += tether.dynamicVelY * dt;

        if (trav.launchTimer <= 0) {
            trav.state = "AIRBORNE";
            trav.wallDir = 0;

            const dx = target.x - tether.anchorX;
            const dy = target.y - tether.anchorY;
            const distNow = Math.sqrt(dx * dx + dy * dy) || this.BASE_ROPE_LENGTH;
            tether.maxLength = Math.max(this.BASE_ROPE_LENGTH, distNow);
        }
    }

    private resolveWallContact(
        nextX: number,
        nextY: number,
        dt: number,
        target: KinematicTargetComponent,
        tether: TetherComponent,
        trav: TraversalStateComponent,
        input: InputIntentComponent
    ): void {
        const hitRight = nextX >  this.WALL_LIMIT_X;
        const hitLeft  = nextX < -this.WALL_LIMIT_X;
        const wallDir  = hitRight ? 1 : hitLeft ? -1 : 0;

        if (trav.state === "WALL_SLIDING") {
            const stillPressingIn = input.x === trav.wallDir;

            if (!stillPressingIn) {
                this.triggerFling(tether, target, trav);
                target.x = nextX;
                target.y = nextY;
                return;
            }

            target.x = trav.wallDir * this.WALL_LIMIT_X;
            target.y = nextY;
            tether.dynamicVelX = 0;
            tether.dynamicVelY = Math.max(tether.dynamicVelY, this.WALL_SLIDE_SPEED);

            tether.tension = Math.min(1.0, tether.tension + this.TENSION_CHARGE_RATE * dt);

            const maxStretch = this.MAX_ROPE_LENGTH - this.BASE_ROPE_LENGTH;
            tether.maxLength = this.BASE_ROPE_LENGTH + tether.tension * maxStretch;

            if (input.jump) {
                this.triggerFling(tether, target, trav);
                input.jump = false;
            }

            return;
        }

        if (wallDir !== 0) {
            const pressingIn = input.x === wallDir;

            if (pressingIn) {
                trav.state    = "WALL_SLIDING";
                trav.wallDir  = wallDir;
                trav.wallNormalX = -wallDir;
                trav.wallNormalY = 0;

                target.x = wallDir * this.WALL_LIMIT_X;
                target.y = nextY;
                tether.dynamicVelX = 0;
                tether.dynamicVelY = Math.max(tether.dynamicVelY, this.WALL_SLIDE_SPEED);

                tether.tension = Math.min(1.0, tether.tension + this.TENSION_CHARGE_RATE * dt);
                const maxStretch = this.MAX_ROPE_LENGTH - this.BASE_ROPE_LENGTH;
                tether.maxLength = this.BASE_ROPE_LENGTH + tether.tension * maxStretch;
            } else {
                target.x = wallDir * this.WALL_LIMIT_X;
                target.y = nextY;
                if (Math.sign(tether.dynamicVelX) === wallDir) {
                    tether.dynamicVelX *= -0.2;
                }
                trav.state   = "AIRBORNE";
                trav.wallDir = 0;
                tether.tension = Math.max(0, tether.tension - 4.0 * dt);
            }
            return;
        }

        trav.state   = "AIRBORNE";
        trav.wallDir = 0;
        tether.tension = Math.max(0, tether.tension - 4.0 * dt);
        target.x = nextX;
        target.y = nextY;
    }

    private triggerFling(
        tether: TetherComponent,
        target: KinematicTargetComponent,
        trav: TraversalStateComponent
    ): void {
        const storedTension = tether.tension;
        tether.tension  = 0.0;
        tether.maxLength = this.BASE_ROPE_LENGTH;

        if (storedTension < this.MIN_FLING_TENSION) {
            trav.state      = "AIRBORNE";
            trav.wallDir    = 0;
            trav.launchPower = 0;
            return;
        }

        const dx   = tether.anchorX - target.x;
        const dy   = tether.anchorY - target.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const power = storedTension * this.FLING_IMPULSE;
        tether.dynamicVelX = (dx / dist) * power;
        tether.dynamicVelY = (dy / dist) * power;

        trav.state       = "LAUNCHING";
        trav.launchTimer = this.LAUNCH_DURATION;
        trav.launchPower = storedTension;
        trav.wallDir     = 0;

        tether.maxLength = this.MAX_ROPE_LENGTH * 2.5;

        this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
            amplitude: 0.25 + storedTension * 0.35,
            duration: 0.2
        });
    }

    private enforceRopeConstraint(
        target: KinematicTargetComponent,
        tether: TetherComponent
    ): void {
        const dx   = target.x - tether.anchorX;
        const dy   = target.y - tether.anchorY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;

        if (dist > tether.maxLength) {
            const nx = dx / dist;
            const ny = dy / dist;

            target.x = tether.anchorX + nx * tether.maxLength;
            target.y = tether.anchorY + ny * tether.maxLength;

            const dot = tether.dynamicVelX * nx + tether.dynamicVelY * ny;
            if (dot > 0) {
                tether.dynamicVelX -= dot * nx;
                tether.dynamicVelY -= dot * ny;
            }
        }
    }
}
