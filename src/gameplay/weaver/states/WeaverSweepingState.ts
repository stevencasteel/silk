import { IWeaverState, WeaverStateType } from "../IWeaverState";
import { GameEvent } from "../../../core/events/GameEvents";
import { WEAVER_AI_TUNING, VISUAL_JUICE_CONFIG, ARENA_CONFIG } from "../../../core/engine/ArenaConfig";
import { SystemContext } from "../../../core/engine/SystemContext";
import {
  TransformComponent,
  HealthComponent,
  WeaverAIComponent
} from "../../../core/ecs/Components";
import * as BABYLON from "@babylonjs/core";

const HASH = String.fromCharCode(35);

export class WeaverSweepingState implements IWeaverState {
  public readonly type: WeaverStateType = "SWEEPING";
  public readonly name = "SWEEPING CEILING";
  public readonly hue = HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.SWEEPING;
  private shootTimer = 0.0;
  private hasTelegraphed = false;

  public enter(ctx: SystemContext): void {
    this.shootTimer = 0.0;
    this.hasTelegraphed = false;

    const aiComp = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);
    if (aiComp) {
      aiComp.timeInState = 0;
      aiComp.hue = this.hue;
    }

    const healthStore = ctx.stores.get<HealthComponent>("health");
    const health = healthStore.get(ctx.refs.weaver);
    const isBerserk = health
      ? health.current < health.max * WEAVER_AI_TUNING.BERSERK_HP_THRESHOLD
      : false;
    const patrolSpeed = isBerserk
      ? WEAVER_AI_TUNING.PATROL.SPEED_BERSERK
      : WEAVER_AI_TUNING.PATROL.SPEED_NORMAL;

    ctx.commands.dispatch({
      type: "SET_KINEMATIC_VELOCITY",
      entityId: ctx.refs.weaver,
      x: patrolSpeed,
      y: 0,
      z: 0
    });
  }

  public exit(): void {}

  public update(ctx: SystemContext, dt: number): WeaverStateType | null {
    const aiComp = ctx.stores.get<WeaverAIComponent>("weaverAI").get(ctx.refs.weaver);
    // State timer is incremented globally in WeaverBrainSystem

    this.shootTimer += dt;
    const telegraphThreshold = WEAVER_AI_TUNING.SHOOT.TELEGRAPH_TIME;

    if (this.shootTimer >= telegraphThreshold && !this.hasTelegraphed) {
      this.hasTelegraphed = true;
      if (aiComp) {
        aiComp.hue = HASH + VISUAL_JUICE_CONFIG.WEAVER_COLORS.DASH_PREP;
      }
      ctx.broker.publish(GameEvent.CAMERA_SHAKE_TRIGGERED, { amplitude: 0.12, duration: 0.15 });
    }

    if (this.shootTimer >= WEAVER_AI_TUNING.SHOOT.RELOAD_TIME) {
      this.shootTimer = 0.0;
      this.hasTelegraphed = false;
      if (aiComp) {
        aiComp.hue = this.hue;
      }

      const transforms = ctx.stores.get<TransformComponent>("transform");
      const playerTrans = transforms.get(ctx.refs.player);
      const wTrans = transforms.get(ctx.refs.weaver);

      if (playerTrans && wTrans) {
        const radius = ARENA_CONFIG.ENTITY.WEAVER_RADIUS;
        const stingerTipLocal = new BABYLON.Vector3(0, -radius, 0);
        const weaverQuat = new BABYLON.Quaternion(wTrans.qx, wTrans.qy, wTrans.qz, wTrans.qw);
        const stingerTipWorld = new BABYLON.Vector3();
        stingerTipLocal.rotateByQuaternionToRef(weaverQuat, stingerTipWorld);

        ctx.broker.publish(GameEvent.WEAVER_SHOOT, {
          x: wTrans.x + stingerTipWorld.x,
          y: wTrans.y + stingerTipWorld.y,
          tx: playerTrans.x,
          ty: playerTrans.y
        });
      }
    }
    return null;
  }
}
