import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TetherComponent, KinematicTargetComponent, TraversalStateComponent, TransformComponent, InputIntentComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";

export class PlayerKinematicsSystem implements ISystem {
    readonly phase = SystemPhase.Kinematics;
    
    private readonly GRAVITY = -22.0;
    private readonly SWING_STEER_FORCE = 28.0;
    private readonly BASE_ROPE_LENGTH = 10.0;
    private readonly MAX_ROPE_LENGTH = 24.0;
    private readonly WALL_LIMIT_X = 14.2;
    private readonly WALL_SLIDE_SPEED = -4.5;
    private readonly TENSION_CHARGE_RATE = 0.65;
    private readonly FLING_IMPULSE = 45.0;
    private readonly LAUNCH_DURATION = 0.6;
    private readonly DRAG_DAMPING = 0.985;

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
        const target = this.targets.get(this.refs.player);
        const trav = this.traversal.get(this.refs.player);
        const wTrans = this.transforms.get(this.refs.warden);
        const input = this.inputs.get(this.refs.player);

        if (!tether || !target || !trav || !wTrans || !input) return;

        tether.anchorX = wTrans.x;
        tether.anchorY = wTrans.y;
        tether.anchorZ = wTrans.z;

        if (trav.state === "LAUNCHING") {
            this.updateLaunching(dt, tether, trav);
        } else {
            this.updateMovement(dt, tether, trav, input);
        }

        const nextX = target.x + tether.dynamicVelX * dt;
        const nextY = target.y + tether.dynamicVelY * dt;

        this.resolveWallCollisions(nextX, nextY, target, tether, trav, input, dt);

        if (trav.state !== "LAUNCHING") {
            this.applyRopeConstraint(target, tether);
        }

        const dx = target.x - tether.anchorX;
        const dy = target.y - tether.anchorY;
        tether.currentLength = Math.sqrt(dx * dx + dy * dy) || 1.0;
        
        this.broker.publish(GameEvent.ROPE_TENSION_CHANGE, { tension: tether.tension });
    }

    private updateMovement(dt: number, tether: TetherComponent, trav: TraversalStateComponent, input: InputIntentComponent) {
        tether.dynamicVelY += this.GRAVITY * dt;

        if (trav.state === "AIRBORNE") {
            tether.dynamicVelX += input.x * this.SWING_STEER_FORCE * dt;
        }

        tether.dynamicVelX *= Math.pow(this.DRAG_DAMPING, dt * 60);
        tether.dynamicVelY *= Math.pow(this.DRAG_DAMPING, dt * 60);
    }

    private updateLaunching(dt: number, tether: TetherComponent, trav: TraversalStateComponent) {
        trav.launchTimer -= dt;
        tether.dynamicVelY += this.GRAVITY * 0.3 * dt;

        if (trav.launchTimer <= 0) {
            trav.state = "AIRBORNE";
            tether.maxLength = this.BASE_ROPE_LENGTH;
        }
    }

    private resolveWallCollisions(nextX: number, nextY: number, target: KinematicTargetComponent, tether: TetherComponent, trav: TraversalStateComponent, input: InputIntentComponent, dt: number) {
        const wallDir = nextX > this.WALL_LIMIT_X ? 1 : (nextX < -this.WALL_LIMIT_X ? -1 : 0);
        
        if (wallDir !== 0 && trav.state !== "LAUNCHING") {
            const isPressingIn = (input.x === wallDir);
            
            if (isPressingIn && tether.dynamicVelY <= 0) {
                if (trav.state !== "WALL_SLIDING") {
                    trav.state = "WALL_SLIDING";
                    trav.wallNormalX = -wallDir;
                }
                
                target.x = wallDir * this.WALL_LIMIT_X;
                target.y = nextY;
                tether.dynamicVelX = 0;
                tether.dynamicVelY = Math.max(tether.dynamicVelY, this.WALL_SLIDE_SPEED);
                
                const stretch = Math.max(0, tether.currentLength - this.BASE_ROPE_LENGTH);
                const maxStretch = this.MAX_ROPE_LENGTH - this.BASE_ROPE_LENGTH;
                const physicalTension = Math.min(1.0, stretch / maxStretch);
                
                tether.tension = Math.min(1.0, tether.tension + this.TENSION_CHARGE_RATE * dt);
                tether.tension = Math.max(tether.tension, physicalTension);
                
                tether.maxLength = this.BASE_ROPE_LENGTH + (tether.tension * maxStretch);
            } else {
                if (trav.state === "WALL_SLIDING") {
                    this.triggerFling(tether, target, trav, input);
                } else {
                    trav.state = "AIRBORNE";
                }
                target.x = wallDir * this.WALL_LIMIT_X;
                target.y = nextY;
                if (Math.sign(tether.dynamicVelX) === wallDir) {
                    tether.dynamicVelX = 0;
                }
            }
        } else {
            if (trav.state === "WALL_SLIDING") {
                this.triggerFling(tether, target, trav, input);
            } else if (trav.state !== "LAUNCHING") {
                trav.state = "AIRBORNE";
            }
            target.x = nextX;
            target.y = nextY;
        }

        if (trav.state === "WALL_SLIDING" && input.jump) {
            this.triggerFling(tether, target, trav, input);
            input.jump = false;
        }
    }

    private triggerFling(tether: TetherComponent, target: KinematicTargetComponent, trav: TraversalStateComponent, input: InputIntentComponent) {
        if (tether.tension > 0.1) {
            const dx = tether.anchorX - target.x;
            const dy = tether.anchorY - target.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            const dirX = dx / dist;
            const dirY = dy / dist;
            
            const power = tether.tension * this.FLING_IMPULSE;
            
            tether.dynamicVelX = dirX * power + (input.x * 10.0);
            tether.dynamicVelY = dirY * power;
            
            trav.state = "LAUNCHING";
            trav.launchTimer = this.LAUNCH_DURATION;
            trav.launchPower = tether.tension;
            tether.maxLength = this.MAX_ROPE_LENGTH * 2;
            
            this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.3 * tether.tension, duration: 0.2 });
        } else {
            trav.state = "AIRBORNE";
            trav.launchPower = 0;
        }
        
        tether.tension = 0.0;
        tether.maxLength = this.BASE_ROPE_LENGTH;
    }

    private applyRopeConstraint(target: KinematicTargetComponent, tether: TetherComponent) {
        const dx = target.x - tether.anchorX;
        const dy = target.y - tether.anchorY;
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
