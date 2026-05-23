import { ISystem } from "../../contracts/ISystem";
import { SystemPhase } from "../../contracts/SystemPhase";
import { EventBroker } from "../../core/events/EventBroker";
import { GameEvent } from "../../core/events/GameEvents";
import { ComponentStore } from "../../core/ecs/ComponentStore";
import { TransformComponent, HealthComponent, TetherComponent, WardenAIComponent, KinematicVelocityComponent, InvulnerabilityComponent } from "../../core/ecs/Components";
import { EntityRefs } from "../../core/ecs/EntityRefs";

export class GameDirectorSystem implements ISystem {
  readonly phase = SystemPhase.Gameplay;
  private gameState: "PLAYING" | "GAME_OVER" | "VICTORY" = "PLAYING";
  private resetRequested = false;

  constructor(
    private broker: EventBroker,
    private refs: EntityRefs,
    private transforms: ComponentStore<TransformComponent>,
    private healths: ComponentStore<HealthComponent>,
    private tethers: ComponentStore<TetherComponent>,
    private wardenAIs: ComponentStore<WardenAIComponent>,
    private velocities: ComponentStore<KinematicVelocityComponent>,
    private iframes: ComponentStore<InvulnerabilityComponent>
  ) {}

  public init(): void {
    this.broker.subscribe(GameEvent.PLAYER_DIED, () => {
      if (this.gameState === "PLAYING") {
        this.gameState = "GAME_OVER";
        this.broker.publish(GameEvent.GAME_OVER, undefined);
      }
    });

    this.broker.subscribe(GameEvent.WARDEN_DIED, () => {
      if (this.gameState === "PLAYING") {
        this.gameState = "VICTORY";
        this.broker.publish(GameEvent.GAME_WIN, undefined);
      }
    });

    window.addEventListener("keydown", this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key.toLowerCase() === "r" && this.gameState !== "PLAYING") {
      this.resetRequested = true;
    }
  };

  public update(_dt: number): void {
    if (this.resetRequested) {
      this.resetGame();
      this.resetRequested = false;
    }
  }

  private resetGame(): void {
    this.gameState = "PLAYING";

    const pTrans = this.transforms.get(this.refs.player);
    const pHealth = this.healths.get(this.refs.player);
    const pTether = this.tethers.get(this.refs.player);
    const pVel = this.velocities.get(this.refs.player);
    const pIframe = this.iframes.get(this.refs.player);

    if (pTrans) { pTrans.x = 0; pTrans.y = 10; pTrans.z = 0; }
    if (pHealth) { pHealth.current = pHealth.max; }
    if (pTether) { 
      pTether.isAttached = true; 
      pTether.maxLength = 12; 
      pTether.dynamicVelX = 0; 
      pTether.dynamicVelY = 0; 
    }
    if (pVel) { pVel.x = 0; pVel.y = 0; pVel.z = 0; }
    if (pIframe) { pIframe.timeRemaining = 0; }

    const wTrans = this.transforms.get(this.refs.warden);
    const wHealth = this.healths.get(this.refs.warden);
    const wAI = this.wardenAIs.get(this.refs.warden);
    const wVel = this.velocities.get(this.refs.warden);

    if (wTrans) { wTrans.x = 5; wTrans.y = 5; wTrans.z = 0; }
    if (wHealth) { wHealth.current = wHealth.max; }
    if (wAI) { 
      wAI.state = "DORMANT"; 
      wAI.timeInState = 0; 
      wAI.hue = "#4b5563"; 
      wAI.hasFakedDeath = false;
    }
    if (wVel) { wVel.x = 0; wVel.y = 0; wVel.z = 0; }

    this.broker.publish(GameEvent.GAME_RESET, undefined);
    this.broker.publish(GameEvent.PLAYER_HEALTH_CHANGED, { hp: pHealth?.max || 5, maxHp: pHealth?.max || 5 });
    this.broker.publish(GameEvent.WARDEN_STATE_CHANGE, { state: "DORMANT", hue: "#4b5563" });
    this.broker.publish(GameEvent.WARDEN_HEALTH_CHANGED, { hp: wHealth?.max || 100, maxHp: wHealth?.max || 100 });
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
  }
}
