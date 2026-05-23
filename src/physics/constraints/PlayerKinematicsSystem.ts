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

// ---------------------------------------------------------------------------
// PlayerKinematicsSystem
// Owns all player motion: pendulum physics, wall-slide state, tension charge,
// fling launch. Rope constraint is only enforced while AIRBORNE.
// ---------------------------------------------------------------------------

export class PlayerKinematicsSystem implements ISystem {
    readonly phase = SystemPhase.Kinematics;

    // Physics constants
    private readonly GRAVITY             = -22.0;
    private readonly SWING_STEER_FORCE   = 28.0;
    private readonly BASE_ROPE_LENGTH    = 10.0;
    private readonly MAX_ROPE_LENGTH     = 22.0;
    private readonly WALL_LIMIT_X        = 14.2;
    private readonly WALL_SLIDE_SPEED    = -3.0;
    private readonly DRAG_DAMPING        = 0.985;

    // Wall-slide charge constants
    private readonly TENSION_CHARGE_RATE = 0.52;   // 100 % in ~1.92 s
    private readonly MIN_FLING_TENSION   = 0.06;   // Tiny tensions just leave wall

    // Fling constants
    private readonly FLING_IMPULSE       = 48.0;
    private readonly LAUNCH_DURATION     = 0.65;
    private readonly LAUNCH_GRAVITY_MULT = 0.22;   // Gravity reduction mid-fling

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

    // -----------------------------------------------------------------------
    public update(dt: number): void {
        const tether = this.tethers.get(this.refs.player);
        const target  = this.targets.get(this.refs.player);
        const trav    = this.traversal.get(this.refs.player);
        const wTrans  = this.transforms.get(this.refs.warden);
        const input   = this.inputs.get(this.refs.player);

        if (!tether || !target || !trav || !wTrans || !input) return;

        // Anchor always tracks the warden
        tether.anchorX = wTrans.x;
        tether.anchorY = wTrans.y;
        tether.anchorZ = wTrans.z;

        if (trav.state === "LAUNCHING") {
            this.stepLaunching(dt, tether, target, trav);
        } else {
            this.stepPhysics(dt, tether, trav, input);

            const nextX = target.x + tether.dynamicVelX * dt;
            const nextY = target.y + tether.dynamicVelY * dt;

            this.resolveWallContact(nextX, nextY, dt, target, tether, trav, input);

            if (trav.state === "AIRBORNE") {
                this.enforceRopeConstraint(target, tether);
            }
        }

        // Compute rope length for HUD + visuals
        const dx = target.x - tether.anchorX;
        const dy = target.y - tether.anchorY;
        tether.currentLength = Math.sqrt(dx * dx + dy * dy) || 1.0;

        this.broker.publish(GameEvent.ROPE_TENSION_CHANGE, { tension: tether.tension });

        // Notify HUD on state changes
        if (trav.state !== this.lastTraversalState) {
            this.lastTraversalState = trav.state;
            this.broker.publish(GameEvent.PLAYER_STATE_CHANGE, { state: trav.state });
        }
    }

    // -----------------------------------------------------------------------
    // Pendulum physics (AIRBORNE only)
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

    // -----------------------------------------------------------------------
    // Fling arc: reduced gravity, timer countdown
    private stepLaunching(
        dt: number,
        tether: TetherComponent,
        target: KinematicTargetComponent,
        trav: TraversalStateComponent
    ): void {
        trav.launchTimer -= dt;
        tether.dynamicVelY += this.GRAVITY * this.LAUNCH_GRAVITY_MULT * dt;

        target.x += tether.dynamicVelX * dt;
        target.y += tether.dynamicVelY * dt;

        if (trav.launchTimer <= 0) {
            trav.state = "AIRBORNE";
            trav.wallDir = 0;

            // Soft rope transition: allow current distance, no snap
            const dx = target.x - tether.anchorX;
            const dy = target.y - tether.anchorY;
            const distNow = Math.sqrt(dx * dx + dy * dy) || this.BASE_ROPE_LENGTH;
            tether.maxLength = Math.max(this.BASE_ROPE_LENGTH, distNow);
        }
    }

    // -----------------------------------------------------------------------
    // Wall contact state machine
    // AIRBORNE -> WALL_SLIDING  : hit wall boundary while pressing into it
    // WALL_SLIDING -> LAUNCHING : player releases direction key (or presses jump)
    // WALL_SLIDING -> AIRBORNE  : somehow drifted off wall (edge case)
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

        // --- Currently sliding on a wall ---
        if (trav.state === "WALL_SLIDING") {
            const stillPressingIn = input.x === trav.wallDir;

            if (!stillPressingIn) {
                // Key released: immediate fling
                this.triggerFling(tether, target, trav);
                target.x = nextX;
                target.y = nextY;
                return;
            }

            // Continue slide: lock X, allow gravity-driven descent
            target.x = trav.wallDir * this.WALL_LIMIT_X;
            target.y = nextY;
            tether.dynamicVelX = 0;
            tether.dynamicVelY = Math.max(tether.dynamicVelY, this.WALL_SLIDE_SPEED);

            // Accumulate tension (0 -> 1 charge bar)
            tether.tension = Math.min(1.0, tether.tension + this.TENSION_CHARGE_RATE * dt);

            // Allow rope to elongate visually with tension build
            const maxStretch = this.MAX_ROPE_LENGTH - this.BASE_ROPE_LENGTH;
            tether.maxLength = this.BASE_ROPE_LENGTH + tether.tension * maxStretch;

            // Jump also flings
            if (input.jump) {
                this.triggerFling(tether, target, trav);
                input.jump = false;
            }

            return;
        }

        // --- Contacted wall while not already sliding ---
        if (wallDir !== 0) {
            const pressingIn = input.x === wallDir;

            if (pressingIn) {
                // Enter wall slide (no upward-velocity gate – intentional press is enough)
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
                // Grazes wall without pressing: soft elastic bounce
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

        // --- Free air ---
        trav.state   = "AIRBORNE";
        trav.wallDir = 0;
        tether.tension = Math.max(0, tether.tension - 4.0 * dt);
        target.x = nextX;
        target.y = nextY;
    }

    // -----------------------------------------------------------------------
    // Convert stored tension into a directed velocity impulse
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

        // Direction: from current position toward the anchor (warden)
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

        // Large rope slack so constraint never yanks the arc short
        tether.maxLength = this.MAX_ROPE_LENGTH * 2.5;

        this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, {
            amplitude: 0.25 + storedTension * 0.35,
            duration: 0.2
        });
    }

    // -----------------------------------------------------------------------
    // Pendulum length constraint (AIRBORNE only)
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

            // Remove radial velocity component (inelastic constraint)
            const dot = tether.dynamicVelX * nx + tether.dynamicVelY * ny;
            if (dot > 0) {
                tether.dynamicVelX -= dot * nx;
                tether.dynamicVelY -= dot * ny;
            }
        }
    }
}
