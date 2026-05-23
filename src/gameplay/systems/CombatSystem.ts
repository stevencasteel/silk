import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent, HealthComponent, WardenAIComponent, TetherComponent, InvulnerabilityComponent, TraversalStateComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { CommandBus } from "../../core/commands/CommandBus";
import { ApplyImpulseCommand } from "../../physics/commands/PhysicsCommands";

export class CombatSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;
  
  private playerHitRadius = 0.8;
  private wardenHitRadius = 1.5;
  private wardenDamage = 1;
  private playerIframeDuration = 1.5;
  private playerAttackDamage = 25;

  constructor(
    private refs: EntityRefs,
    private transforms: ComponentStore<TransformComponent>,
    private healths: ComponentStore<HealthComponent>,
    private wardenAIs: ComponentStore<WardenAIComponent>,
    private tethers: ComponentStore<TetherComponent>,
    private iframes: ComponentStore<InvulnerabilityComponent>,
    traversal: ComponentStore<TraversalStateComponent>,
    private broker: EventBroker,
    private commands: CommandBus
  ) {
    void traversal;
  }

  public update(dt: number): void {
    const pTrans = this.transforms.get(this.refs.player);
    const wTrans = this.transforms.get(this.refs.warden);
    const pHealth = this.healths.get(this.refs.player);
    const wHealth = this.healths.get(this.refs.warden);
    const wAI = this.wardenAIs.get(this.refs.warden);
    const pIframe = this.iframes.get(this.refs.player);
    const tether = this.tethers.get(this.refs.player);

    if (!pTrans || !wTrans || !pHealth || !wHealth || !wAI || !pIframe || !tether) return;

    if (pIframe.timeRemaining > 0) {
      pIframe.timeRemaining -= dt;
    }

    const dx = pTrans.x - wTrans.x;
    const dy = pTrans.y - wTrans.y;
    const distSq = dx * dx + dy * dy;
    const hitDist = this.playerHitRadius + this.wardenHitRadius;
    const isColliding = distSq < (hitDist * hitDist);

    if (isColliding) {
      if (wAI.state === "RECOVERY" || wAI.state === "DAZED RECOVERY") {
        const dmg = this.playerAttackDamage * dt;
        wHealth.current -= dmg;
        this.broker.publish(GameEvent.WARDEN_DAMAGED, { amount: dmg, source: "PLAYER" });
        this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.2, duration: 0.1 });
        
        if (wHealth.current <= 0) {
          wHealth.current = 0;
          this.broker.publish(GameEvent.WARDEN_DIED, undefined);
        }
      } 
      else if (pIframe.timeRemaining <= 0 && (wAI.state === "CHARGE_ATTACK" || wAI.state === "RUSH ATTACK" || wAI.state === "HUNTING")) {
        pHealth.current -= this.wardenDamage;
        pIframe.timeRemaining = this.playerIframeDuration;
        
        const dist = Math.sqrt(distSq) || 1;
        const knockbackForce = 15;
        const kbX = (dx / dist) * knockbackForce;
        const kbY = (dy / dist) * knockbackForce + 5;
        
        this.commands.dispatch<ApplyImpulseCommand>({
          type: "APPLY_IMPULSE",
          entityId: this.refs.player,
          x: kbX,
          y: kbY,
          z: 0
        });

        this.broker.publish(GameEvent.PLAYER_DAMAGED, { amount: this.wardenDamage, source: "WARDEN" });
        this.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.5, duration: 0.3 });

        if (pHealth.current <= 0) {
          pHealth.current = 0;
          this.broker.publish(GameEvent.PLAYER_DIED, undefined);
        }
      }
    }
  }
}
