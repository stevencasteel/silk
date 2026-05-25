export enum GameEvent {
  GAME_INITIALIZED = "GAME_INITIALIZED",
  GAME_BOOT_PROGRESS = "GAME_BOOT_PROGRESS",
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
  PROJECTILE_IMPACT = "PROJECTILE_IMPACT"
}

export interface GameEventMap {
  [GameEvent.GAME_INITIALIZED]: void;
  [GameEvent.GAME_BOOT_PROGRESS]: { status: string };
  [GameEvent.USER_GESTURE_REGISTERED]: void;
  [GameEvent.PLAYER_HEALTH_CHANGED]: { hp: number; maxHp: number };
  [GameEvent.PLAYER_DAMAGED]: { amount: number; source: string };
  [GameEvent.PLAYER_DIED]: void;
  [GameEvent.PLAYER_STATE_CHANGE]: { state: string };
  [GameEvent.TETHER_TENSION_CHANGE]: { tension: number };
  [GameEvent.TETHER_LENGTH_CHANGE]: { length: number; maxLength: number };
  [GameEvent.WEAVER_STATE_CHANGE]: { state: string; hue: string };
  [GameEvent.WEAVER_DAMAGED]: { amount: number; source: string };
  [GameEvent.WEAVER_HEALTH_CHANGED]: { hp: number; maxHp: number };
  [GameEvent.WEAVER_DIED]: void;
  [GameEvent.CAMERA_SHAKE_TRIGGERED]: { amplitude: number; duration: number };
  [GameEvent.GAME_OVER]: void;
  [GameEvent.GAME_WIN]: void;
  [GameEvent.GAME_RESET]: void;
  [GameEvent.WEAVER_SHOOT]: { x: number; y: number; tx: number; ty: number };
  [GameEvent.GAME_PAUSED]: { isPaused: boolean };
  [GameEvent.PLAYER_LANDED]: { x: number; y: number };
  [GameEvent.PLAYER_WALL_HIT]: { x: number; y: number; wallNormalX: number };
  [GameEvent.PROJECTILE_IMPACT]: { x: number; y: number; isWall: boolean };
}
