import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
    SilkComponent,
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
    private readonly BASE_SILK_LENGTH    = 12.0;
    private readonly MAX_SILK_LENGTH     = 24.0;
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
        private silks: ComponentStore<SilkComponent>,
        private targets: ComponentStore<KinematicTargetComponent>,
        private traversal: ComponentStore<TraversalStateComponent>,
        private transforms: ComponentStore<TransformComponent>,
        private inputs: ComponentStore<InputIntentComponent>,
        private broker: EventBroker
    ) {}

    public update(dt: number): void {
        const silk = this.silks.get(this.refs.player);
        const target  = this.targets.get(this.refs.player);
        const trav    = this.traversal.get(this.refs.player);
        const sTrans  = this.transforms.get(this.refs.spider);
        const input   = this.inputs.get(this.refs.player);

        if (!silk || !target || !trav || !sTrans || !input) return;

        silk.anchorX = sTrans.x;
        silk.anchorY = sTrans.y;
        silk.anchorZ = sTrans.z;

        if (trav.state === "LAUNCHING") {
            this.stepLaunching(dt, silk, target, trav, input);
        } else {
            this.stepPhysics(dt, silk, trav, input);

            const nextX = target.x + silk.dynamicVelX * dt;
            const nextY = target.y + silk.dynamicVelY * dt;

            this.resolveWallContact(nextX, nextY, dt, target, silk, trav, input);

            if (trav.state === "AIRBORNE") {
                this.enforceSilkConstraint(target, silk);
            }
        }

        const dx = target.x - silk.anchorX;
        const dy = target.y - silk.anchorY;
        silk.currentLength = Math.sqrt(dx * dx + dy * dy) || 1.0;

        this.broker.publish(GameEvent.SILK_TENSION_CHANGE, { tension: silk.tension });

        if (trav.state !== this.lastTraversalState) {
            this.lastTraversalState = trav.state;
            this.broker.publish(GameEvent.PLAYER_STATE_CHANGE, { state: trav.state });
        }
    }

    private stepPhysics(
        dt: number,
        silk: SilkComponent,
        trav: TraversalStateComponent,
        input: InputIntentComponent
    ): void {
        silk.dynamicVelY += this.GRAVITY * dt;

        if (trav.state === "AIRBORNE") {
            silk.dynamicVelX += input.x * this.SWING_STEER_FORCE * dt;
        }

        const damp = Math.pow(this.DRAG_DAMPING, dt * 60);
        silk.dynamicVelX *= damp;
        silk.dynamicVelY *= damp;
    }

    private stepLaunching(
        dt: number,
        silk: SilkComponent,
        target: KinematicTargetComponent,
        trav: TraversalStateComponent,
        input: InputIntentComponent
    ): void {
        trav.launchTimer -= dt;

        silk.dynamicVelX += input.x * this.LAUNCH_STEER_FORCE * dt;
        silk.dynamicVelY += this.GRAVITY * this.LAUNCH_GRAVITY_MULT * dt;

        const damp = Math.pow(this.DRAG_DAMPING, dt * 60);
        silk.dynamicVelX *= damp;
        silk.dynamicVelY *= damp;

        target.x += silk.dynamicVelX * dt;
        target.y += silk.dynamicVelY * dt;

        if (trav.launchTimer <= 0) {
            trav.state = "AIRBORNE";
            trav.wallDir = 0;

            const dx = target.x - silk.anchorX;
            const dy = target.y - silk.anchorY;
            const distNow = Math.sqrt(dx * dx + dy * dy) || this.BASE_SILK_LENGTH;
            silk.maxLength = Math.max(this.BASE_SILK_LENGTH, distNow);
        }
    }

    private resolveWallContact(
        nextX: number,
        nextY: number,
        dt: number,
        target: KinematicTargetComponent,
        silk: SilkComponent,
        trav: TraversalStateComponent,
        input: InputIntentComponent
    ): void {
        const hitRight = nextX >  this.WALL_LIMIT_X;
        const hitLeft  = nextX < -this.WALL_LIMIT_X;
        const wallDir  = hitRight ? 1 : hitLeft ? -1 : 0;

        if (trav.state === "WALL_SLIDING") {
            const stillPressingIn = input.x === trav.wallDir;

            if (!stillPressingIn) {
                this.triggerFling(silk, target, trav);
                target.x = nextX;
                target.y = nextY;
                return;
            }

            target.x = trav.wallDir * this.WALL_LIMIT_X;
            target.y = nextY;
            silk.dynamicVelX = 0;
            silk.dynamicVelY = Math.max(silk.dynamicVelY, this.WALL_SLIDE_SPEED);

            silk.tension = Math.min(1.0, silk.tension + this.TENSION_CHARGE_RATE * dt);

            const maxStretch = this.MAX_SILK_LENGTH - this.BASE_SILK_LENGTH;
            silk.maxLength = this.BASE_SILK_LENGTH + silk.tension * maxStretch;

            if (input.jump) {
                this.triggerFling(silk, target, trav);
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
                silk.dynamicVelX = 0;
                silk.dynamicVelY = Math.max(silk.dynamicVelY, this.WALL_SLIDE_SPEED);

                silk.tension = Math.min(1.0, silk.tension + this.TENSION_CHARGE_RATE * dt);
                const maxStretch = this.MAX_SILK_LENGTH - this.BASE_SILK_LENGTH;
                silk.maxLength = this.BASE_SILK_LENGTH + silk.tension * maxStretch;
            } else {
                target.x = wallDir * this.WALL_LIMIT_X;
                target.y = nextY;
                if (Math.sign(silk.dynamicVelX) === wallDir) {
                    silk.dynamicVelX *= -0.2;
                }
                trav.state   = "AIRBORNE";
                trav.wallDir = 0;
                silk.tension = Math.max(0, silk.tension - 4.0 * dt);
            }
            return;
        }

        trav.state   = "AIRBORNE";
        trav.wallDir = 0;
        silk.tension = Math.max(0, silk.tension - 4.0 * dt);
        target.x = nextX;
        target.y = nextY;
    }

    private triggerFling(
        silk: SilkComponent,
        target: KinematicTargetComponent,
        trav: TraversalStateComponent
    ): void {
        const storedTension = silk.tension;
        silk.tension  = 0.0;
        silk.maxLength = this.BASE_SILK_LENGTH;

        if (storedTension < this.MIN_FLING_TENSION) {
            trav.state      = "AIRBORNE";
            trav.wallDir    = 0;
            trav.launchPower = 0;
            return;
        }

        const dx   = silk.anchorX - target.x;
        const dy   = silk.anchorY - target.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const power = storedTension * this.FLING_IMPULSE;
        silk.dynamicVelX = (dx / dist) * power;
        silk.dynamicVelY = (dy / dist) * power;

        trav.state       = "LAUNCHING";
        trav.launchTimer = this.LAUNCH_DURATION;
        trav.launchPower = storedTension;
        trav.wallDir     = 0;

        silk.maxLength = this.MAX_SILK_LENGTH * 2.5;

        this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
            amplitude: 0.25 + storedTension * 0.35,
            duration: 0.2
        });
    }

    private enforceSilkConstraint(
        target: KinematicTargetComponent,
        silk: SilkComponent
    ): void {
        const dx   = target.x - silk.anchorX;
        const dy   = target.y - silk.anchorY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;

        if (dist > silk.maxLength) {
            const nx = dx / dist;
            const ny = dy / dist;

            target.x = silk.anchorX + nx * silk.maxLength;
            target.y = silk.anchorY + ny * silk.maxLength;

            const dot = silk.dynamicVelX * nx + silk.dynamicVelY * ny;
            if (dot > 0) {
                silk.dynamicVelX -= dot * nx;
                silk.dynamicVelY -= dot * ny;
            }
        }
    }
}
