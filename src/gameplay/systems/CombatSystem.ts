import { ARENA_CONFIG } from "../../core/engine/ArenaConfig";
import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import {
  TransformComponent,
  HealthComponent,
  WeaverAIComponent,
  SilkComponent,
  InvulnerabilityComponent,
  TraversalStateComponent,
  KinematicTargetComponent
} from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { CommandBus } from "../../core/commands/CommandBus";
import { ApplyImpulseCommand } from "../../physics/commands/PhysicsCommands";
import { IVisualRegistry } from "../../contracts/IVisualRegistry";
import * as BABYLON from "@babylonjs/core";

export class CombatSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;

  private readonly FLING_DAMAGE_THRESHOLD = 0.72;
  private readonly WEAVER_CONTACT_DAMAGE = 1;
  private readonly PLAYER_IFRAME_DURATION = 1.2;
  private readonly PLAYER_FLING_DAMAGE = 35;
  private readonly COMBINED_RADIUS_THRESHOLD = ARENA_CONFIG.ENTITY.PLAYER_RADIUS + ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
  private readonly BROADPHASE_ENVELOPE = (ARENA_CONFIG.ENTITY.PLAYER_RADIUS + ARENA_CONFIG.ENTITY.WEAVER_RADIUS + 0.4) * (ARENA_CONFIG.ENTITY.PLAYER_RADIUS + ARENA_CONFIG.ENTITY.WEAVER_RADIUS + 0.4);

  constructor(
    private refs: EntityRefs,
    private transforms: ComponentStore<TransformComponent>,
    private healths: ComponentStore<HealthComponent>,
    private weaverAIs: ComponentStore<WeaverAIComponent>,
    private silks: ComponentStore<SilkComponent>,
    private iframes: ComponentStore<InvulnerabilityComponent>,
    private traversal: ComponentStore<TraversalStateComponent>,
    private broker: EventBroker,
    private commands: CommandBus,
    private visualRegistry: IVisualRegistry,
    private targets: ComponentStore<KinematicTargetComponent>
  ) {}

  public update(dt: number): void {
    const pHealth = this.healths.get(this.refs.player);
    const wHealth = this.healths.get(this.refs.weaver);
    const wAI = this.weaverAIs.get(this.refs.weaver);
    const pIframe = this.iframes.get(this.refs.player);
    const silk = this.silks.get(this.refs.player);
    const pTrav = this.traversal.get(this.refs.player);

    if (!pHealth || !wHealth || !wAI || !pIframe || !silk || !pTrav) return;

    if (pHealth.current <= 0 || wHealth.current <= 0) return;

    if (pIframe.timeRemaining > 0) {
      pIframe.timeRemaining -= dt;
    }

    const pTrans = this.transforms.get(this.refs.player);
    const wTrans = this.transforms.get(this.refs.weaver);
    if (!pTrans || !wTrans) return;

    const dx = pTrans.x - wTrans.x;
    const dy = pTrans.y - wTrans.y;
    const distSq = dx * dx + dy * dy;

    if (distSq > this.BROADPHASE_ENVELOPE) {
      return;
    }

    const pMesh = this.visualRegistry.getTransformNode(this.refs.player) as BABYLON.AbstractMesh;
    const wMesh = this.visualRegistry.getTransformNode(this.refs.weaver) as BABYLON.AbstractMesh;

    if (!pMesh || !wMesh) return;

    const isColliding = pMesh.intersectsMesh(wMesh, true);
    if (!isColliding) return;

    const dist = Math.sqrt(distSq) || 1.0;

    if (pTrav.state === "LAUNCHING" && pTrav.launchPower >= this.FLING_DAMAGE_THRESHOLD) {
      this.resolvePlayerFlingHit(wHealth, silk, pTrav, dx, dy, distSq);
      return;
    }

    const weaverIsHostile = wAI.state === "DASHING";

    if (pIframe.timeRemaining <= 0 && weaverIsHostile) {
      this.resolveWeaverContactHit(pHealth, pIframe, dx, dy, distSq);
      return;
    }

    if (dist < this.COMBINED_RADIUS_THRESHOLD) {
      const overlap = this.COMBINED_RADIUS_THRESHOLD - dist;
      const nx = dx / dist;
      const ny = dy / dist;

      pTrans.x += nx * overlap;
      pTrans.y += ny * overlap;

      const pTarget = this.targets.get(this.refs.player);
      if (pTarget) {
        pTarget.x += nx * overlap;
        pTarget.y += ny * overlap;
      }

      const dot = silk.dynamicVelX * nx + silk.dynamicVelY * ny;
      if (dot < 0) {
        silk.dynamicVelX -= dot * nx * 1.3;
        silk.dynamicVelY -= dot * ny * 1.3;
      }
    }
  }

  private resolvePlayerFlingHit(
    wHealth: HealthComponent,
    silk: SilkComponent,
    pTrav: TraversalStateComponent,
    dx: number,
    dy: number,
    distSq: number
  ): void {
    wHealth.current -= this.PLAYER_FLING_DAMAGE;

    this.broker.publish(GameEvent.WEAVER_DAMAGED, {
      amount: this.PLAYER_FLING_DAMAGE,
      source: "PLAYER_FLING"
    });

    this.broker.publish(GameEvent.WEAVER_HEALTH_CHANGED, {
      hp: Math.max(0, wHealth.current),
      maxHp: wHealth.max
    });

    this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 1.4, duration: 0.55 });

    const dist = Math.sqrt(distSq) || 1;
    silk.dynamicVelX = (dx / dist) * 22;
    silk.dynamicVelY = (dy / dist) * 22;
    pTrav.state = "AIRBORNE";
    pTrav.launchPower = 0;
    pTrav.launchTimer = 0;
  }

  private resolveWeaverContactHit(
    pHealth: HealthComponent,
    pIframe: InvulnerabilityComponent,
    dx: number,
    dy: number,
    distSq: number
  ): void {
    pHealth.current -= this.WEAVER_CONTACT_DAMAGE;
    pIframe.timeRemaining = this.PLAYER_IFRAME_DURATION;

    const dist = Math.sqrt(distSq) || 1;
    this.commands.dispatch<ApplyImpulseCommand>({
      type: "APPLY_IMPULSE",
      entityId: this.refs.player,
      x: (dx / dist) * 16,
      y: (dy / dist) * 16 + 8,
      z: 0
    });

    this.broker.publish(GameEvent.PLAYER_DAMAGED, {
      amount: this.WEAVER_CONTACT_DAMAGE,
      source: "WEAVER"
    });
    this.broker.publish(GameEvent.PLAYER_HEALTH_CHANGED, {
      hp: pHealth.current,
      maxHp: pHealth.max
    });
    this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.5, duration: 0.3 });

    if (pHealth.current <= 0) {
      pHealth.current = 0;
      this.broker.publish(GameEvent.PLAYER_DIED, undefined);
    }
  }
}
