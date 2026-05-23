export enum GameEvent {
  GAME_INITIALIZED = "GAME_INITIALIZED",
  USER_GESTURE_REGISTERED = "USER_GESTURE_REGISTERED",
  PLAYER_MOVE = "PLAYER_MOVE",
  PLAYER_HEALTH_CHANGED = "PLAYER_HEALTH_CHANGED",
  PLAYER_VELOCITY_CHANGED = "PLAYER_VELOCITY_CHANGED",
  ROPE_TENSION_CHANGE = "ROPE_TENSION_CHANGE",
  ROPE_LENGTH_CHANGE = "ROPE_LENGTH_CHANGE",
  WARDEN_STATE_CHANGE = "WARDEN_STATE_CHANGE",
  CAMERA_SHAKE_TRIGGERED = "CAMERA_SHAKE_TRIGGERED"
}

export interface GameEventMap {
  [GameEvent.GAME_INITIALIZED]: void;
  [GameEvent.USER_GESTURE_REGISTERED]: void;
  [GameEvent.PLAYER_MOVE]: { x: number; y: number; z: number };
  [GameEvent.PLAYER_HEALTH_CHANGED]: { hp: number; maxHp: number };
  [GameEvent.PLAYER_VELOCITY_CHANGED]: { velocity: number; maxVelocity: number };
  [GameEvent.ROPE_TENSION_CHANGE]: { tension: number };
  [GameEvent.ROPE_LENGTH_CHANGE]: { length: number; maxLength: number };
  [GameEvent.WARDEN_STATE_CHANGE]: { state: string; hue: string };
  [GameEvent.CAMERA_SHAKE_TRIGGERED]: { amplitude: number; duration: number };
}
