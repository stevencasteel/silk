export enum GameEvent {
  GAME_INITIALIZED = "GAME_INITIALIZED",
  GAME_BOOT_PROGRESS = "GAME_BOOT_PROGRESS",
  GAME_STARTED = "GAME_STARTED",
  USER_GESTURE_REGISTERED = "USER_GESTURE_REGISTERED",
  PLAYER_HEALTH_CHANGED = "PLAYER_HEALTH_CHANGED",
  PLAYER_DAMAGED = "PLAYER_DAMAGED",
  PLAYER_DIED = "PLAYER_DIED",
  PLAYER_STATE_CHANGE = "PLAYER_STATE_CHANGE",
  TETHER_TENSION_CHANGE = "TETHER_TENSION_CHANGE",
  TETHER_LENGTH_CHANGE = "TETHER_LENGTH_CHANGE",
  WEAVER_STATE_CHANGE = "WEAVER_STATE_CHANGE",
  WEAVER_DAMAGED = "WEAVER_DAMAGED",
  WEAVER_HEALTH_CHANGED = "WEAVER_HEALTH_CHANGED",
  WEAVER_DIED = "WEAVER_DIED",
  CAMERA_SHAKE_TRIGGERED = "CAMERA_SHAKE_TRIGGERED",
  GAME_OVER = "GAME_OVER",
  GAME_WIN = "GAME_WIN",
  GAME_RESET = "GAME_RESET",
  WEAVER_SHOOT = "WEAVER_SHOOT",
  GAME_PAUSED = "GAME_PAUSED",
  PLAYER_LANDED = "PLAYER_LANDED",
  PLAYER_WALL_HIT = "PLAYER_WALL_HIT",
  WEAVER_WALL_HIT = "WEAVER_WALL_HIT",
  PROJECTILE_IMPACT = "PROJECTILE_IMPACT",
  PLAYER_INPUT_KEY_STATE_CHANGED = "PLAYER_INPUT_KEY_STATE_CHANGED",
  UI_CALIBRATION_STEP_CHANGED = "UI_CALIBRATION_STEP_CHANGED",
  WEAVER_BOUNCED = "WEAVER_BOUNCED",
  UI_SFX_TICK = "UI_SFX_TICK",
  UI_SFX_CONFIRM = "UI_SFX_CONFIRM",
  UI_SFX_REVEAL = "UI_SFX_REVEAL",
  UI_SFX_DING = "UI_SFX_DING"
}

export interface GameEventMap {
  [GameEvent.GAME_INITIALIZED]: void;
  [GameEvent.GAME_BOOT_PROGRESS]: { status: string; progress?: number; phase?: number };
  [GameEvent.GAME_STARTED]: void;
  [GameEvent.USER_GESTURE_REGISTERED]: void;
  [GameEvent.PLAYER_HEALTH_CHANGED]: { hp: number; maxHp: number };
  [GameEvent.PLAYER_DAMAGED]: { amount: number; source: string };
  [GameEvent.PLAYER_DIED]: void;
  [GameEvent.PLAYER_STATE_CHANGE]: { state: string; launchPower?: number };
  [GameEvent.TETHER_TENSION_CHANGE]: { tension: number };
  [GameEvent.TETHER_LENGTH_CHANGE]: { length: number; maxLength: number };
  [GameEvent.WEAVER_STATE_CHANGE]: {
    state: string;
    hue: string;
  };
  [GameEvent.WEAVER_DAMAGED]: { amount: number; source: string };
  [GameEvent.WEAVER_HEALTH_CHANGED]: { hp: number; maxHp: number };
  [GameEvent.WEAVER_DIED]: void;
  [GameEvent.CAMERA_SHAKE_TRIGGERED]: {
    amplitude: number;
    duration: number;
    dirX?: number;
    dirY?: number;
  };
  [GameEvent.GAME_OVER]: void;
  [GameEvent.GAME_WIN]: void;
  [GameEvent.GAME_RESET]: void;
  [GameEvent.WEAVER_SHOOT]: { x: number; y: number; tx: number; ty: number; isRelease?: boolean };
  [GameEvent.GAME_PAUSED]: { isPaused: boolean };
  [GameEvent.PLAYER_LANDED]: { x: number; y: number };
  [GameEvent.PLAYER_WALL_HIT]: { x: number; y: number; wallNormalX: number };
  [GameEvent.WEAVER_WALL_HIT]: { x: number; y: number; wallNormalX: number };
  [GameEvent.PROJECTILE_IMPACT]: { x: number; y: number; isWall: boolean };
  [GameEvent.PLAYER_INPUT_KEY_STATE_CHANGED]: { key: string; code: string; pressed: boolean };
  [GameEvent.UI_CALIBRATION_STEP_CHANGED]: { step: number };
  [GameEvent.WEAVER_BOUNCED]: void;
  [GameEvent.UI_SFX_TICK]: void;
  [GameEvent.UI_SFX_CONFIRM]: void;
  [GameEvent.UI_SFX_REVEAL]: void;
  [GameEvent.UI_SFX_DING]: void;
}
