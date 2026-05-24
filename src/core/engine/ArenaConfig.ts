export const CANONICAL_UNITS = {
  SPATIAL: {
    METERS_PER_UNIT: 1.0,
  },
  TEMPORAL: {
    LEGACY_FPS_BASIS: 60.0,
  },
  GRAVITY: {
    PHYSICAL_EARTH: -9.81,
    PLAYER_KINEMATIC: -24.0,
    JUICE_PARTICLE: -18.0,
  },
  SILK_STRAIN: {
    OVERLOAD_LIMIT: 1.0,
    SNAP_LIMIT: 1.3,
    SNAP_DELAY_SECONDS: 2.6,
  },
  SCROLL_MAPPING: {
    TOTAL_RANGE: 140.0,
    BOTTOM_BOUNDARY: -56.0,
    TOP_BOUNDARY: 84.0,
  }
} as const;

export const ARENA_CONFIG = {
  HORIZONTAL: {
    WALL_LIMIT_X: 14.2,              // Player constraint wall limit
    WALL_CLING_THRESHOLD_X: 13.6,     // Input wall-clinging registration threshold
    WEAVER_LIMIT_X: 13.8,             // Weaver traversal wall limit
    WEAVER_PATROL_MIN_X: -13.0,       // Weaver sweep patrol start boundary
    WEAVER_PATROL_MAX_X: 13.0,        // Weaver sweep patrol end boundary
    WALL_GEOMETRY_X: 16.0,            // Visual mesh wall center offset
    TICK_GEOMETRY_X: 14.9,            // Visual scrolling tick line offset
    PLAY_AREA_HALF_WIDTH: 15.0,       // Absolute play area edge for physics bounds
  },
  VERTICAL: {
    FLOOR_Y: -8.0,                    // Gameplay floor plane
    CEILING_Y: 38.0,                  // Gameplay ceiling plane
    WEAVER_CEILING_Y: 34.0,           // Weaver sweep patrol baseline height
    WEAVER_CEILING_RETURN_Y: 34.0,    // Weaver returning phase target threshold
    WALL_GEOMETRY_HEIGHT: 140.0,      // Visual height of vertical columns
    TOTAL_SCROLL_RANGE: 140.0,        // Tick wrap-around boundary range
    PLAYER_SPAWN_Y: 10.0,             // Initial player spawner height
    WEAVER_SPAWN_Y: 34.0,             // Initial weaver spawner height
  },
  ENTITY: {
    PLAYER_HEIGHT: 1.8,               // Physical height of capsule
    PLAYER_RADIUS: 0.4,               // Physical radius of capsule
    PLAYER_HALF_HEIGHT: 0.9,          // Calculated half-height for floor clamping
    WEAVER_RADIUS: 2.2,               // Visual radius of target sphere
  },
  PROJECTILE: {
    OFFSCREEN_MIN_Y: -15.0,           // Lower garbage-collection boundary
    OFFSCREEN_MAX_Y: 42.0,            // Upper garbage-collection boundary
  },
  SILK: {
    BASE_LENGTH: 10.0,                // Uncharged physical string length
    MAX_LENGTH: 24.0,                 // Fully stretched dynamic string length
    INITIAL_LENGTH: 12.0,             // Spawning length on game start
  },
  SCROLL_SPEED: {
    BASE: 9.0,                        // Standard vertical elevator scroll (decreased by 25%)
    BERSERK: 15.0,                    // Boss low-health vertical elevator scroll (decreased by 25%)
    DASH_MULTIPLIER: 0.45,            // Dynamic dash vertical displacement multiplier (decreased by 25%)
  }
} as const;

export const GAMEPLAY_TUNING = {
  PLAYER: {
    SWING_STEER_FORCE: 36.0,
    LAUNCH_STEER_FORCE: 16.0,
    TENSION_CHARGE_RATE: 0.38,
    MIN_FLING_TENSION: 0.06,
    FLING_IMPULSE: 76.0,
    LAUNCH_DURATION: 0.7,
    LAUNCH_GRAVITY_MULT: 0.22,
    SCALE_INTERP_RATE: 15.0,
    SLERP_FACTOR: 0.22,
    DRAG_DAMPING: 0.99,
    SQUASH_STRETCH: {
      WALL_SLIDE_X: 0.75,
      WALL_SLIDE_Y: 1.15,
      WALL_SLIDE_Z: 1.0,
      LAUNCH_POWER_MULT: 0.35,
      AIRBORNE_STRETCH_MAX: 0.3,
      AIRBORNE_SPEED_BASIS: 30.0,
      SQUASH_LAND_X: 1.22,
      SQUASH_LAND_Y: 0.72,
      SQUASH_LAND_Z: 1.22,
      SQUASH_WALL_X: 0.72,
      SQUASH_WALL_Y: 1.22,
      LAND_VEL_THRESHOLD: -1.0,
    }
  },
  COMBAT: {
    FLING_DAMAGE_THRESHOLD: 0.72,
    WEAVER_CONTACT_DAMAGE: 1,
    PLAYER_IFRAME_DURATION: 1.2,
    PLAYER_FLING_DAMAGE: 35,
    KNOCKBACK_FORCE_X: 16.0,
    KNOCKBACK_FORCE_Y: 16.0,
    KNOCKBACK_BONUS_Y: 8.0,
    REBOUND_FORCE: 22.0,
    BOUNCE_ELASTICITY_MULT: 1.3,
    BROADPHASE_MARGIN: 0.4,
  }
} as const;

export const WEAVER_AI_TUNING = {
  PATROL: {
    SPEED_NORMAL: 4.5,
    SPEED_BERSERK: 9.0,
  },
  SHOOT: {
    TELEGRAPH_TIME: 1.8,
    RELOAD_TIME: 2.4,
    OFFSET_Y: 1.8,
    SPEED: 15.0,
    MAX_LIFE: 8.0,
    PROJECTILE_DIAMETER: 0.65,
    CAMERA_SHAKE_AMP: 0.6,
    CAMERA_SHAKE_DUR: 0.35,
  },
  DASH: {
    PREP_TIME: 0.6,
    THRUST_TIME: 0.8,
    RECOVER_TIME: 0.5,
    SPEED_NORMAL: 28.0,
    SPEED_BERSERK: 36.0,
    STROBE_FREQ: 16.0,
    SPEED_THRESHOLD: 0.1,
    SQUASH_STRETCH: {
      PREP_X: 1.15,
      PREP_Y: 0.82,
      PREP_Z: 1.15,
      STRETCH_MAX: 0.25,
      STRETCH_SPEED_BASIS: 36.0,
    },
    CAMERA_SHAKE_PREP_AMP: 0.08,
    CAMERA_SHAKE_PREP_DUR: 0.05,
    CAMERA_SHAKE_PREP_FREQ: 0.4,
  },
  RETURN: {
    SPEED: 12.0,
    THRESHOLD: 0.3,
    SQUASH_STRETCH: {
      Y: 1.08,
      X: 0.96,
    }
  },
  DEFEATED: {
    SCALE: 0.2,
  },
  ANIMATION: {
    LERP_RATE: 12.0,
    PULSE_BASE: 0.04,
    PULSE_FREQ: 3.5,
    YAW_PITCH_ROLL_FREQ: 2.0,
    YAW_PITCH_ROLL_AMP: 0.1,
    ROLL_ANGLE_SCALE: -0.02,
  }
} as const;

export const VISUAL_JUICE_CONFIG = {
  PARTICLES: {
    BURST: {
      PLAYER: {
        COUNT: 15,
        VELOCITY_Y_MIN: 4.0,
        VELOCITY_Y_MAX: 12.0,
        VELOCITY_Z_MAX: 4.0,
        VELOCITY_SPEED_MIN: 3.0,
        VELOCITY_SPEED_MAX: 8.0,
        LIFE_MIN: 0.3,
        LIFE_MAX: 0.7,
      },
      WEAVER: {
        COUNT: 20,
        VELOCITY_Y_MIN: 4.0,
        VELOCITY_Y_MAX: 12.0,
        VELOCITY_Z_MAX: 4.0,
        VELOCITY_SPEED_MIN: 3.0,
        VELOCITY_SPEED_MAX: 8.0,
        LIFE_MIN: 0.3,
        LIFE_MAX: 0.7,
      },
      LANDING: {
        COUNT: 12,
        VELOCITY_X_MAX: 6.0,
        VELOCITY_Y_MAX: 1.5,
        VELOCITY_Z_MAX: 1.5,
        LIFE_MIN: 0.4,
        LIFE_MAX: 0.7,
      },
      WALL: {
        COUNT: 8,
        VELOCITY_X_MIN: 4.0,
        VELOCITY_X_MAX: 10.0,
        VELOCITY_Y_MAX: 5.0,
        VELOCITY_Z_MAX: 2.0,
        LIFE_MIN: 0.25,
        LIFE_MAX: 0.5,
      },
      PROJECTILE: {
        COUNT: 10,
        SPEED_MIN: 2.0,
        SPEED_MAX: 6.0,
        VELOCITY_Z_MAX: 2.0,
        LIFE_MIN: 0.3,
        LIFE_MAX: 0.6,
      },
      TRAIL: {
        LIFE_MIN: 0.22,
        LIFE_MAX: 0.34,
        OFFSET_X: 0.3,
        OFFSET_Y: 0.8,
        VELOCITY_X_MAX: 1.2,
        VELOCITY_Y_MAX: 1.2,
        VELOCITY_Z_MAX: 1.0,
      },
    },
    DEBRIS: {
      COUNT: 12,
      SIZE_MIN: 1.0,
      SIZE_MAX: 2.5,
      MASS: 3.0,
      FRICTION: 0.5,
      RESTITUTION: 0.2,
      LIFE: 5.0,
      VELOCITY_X_MAX: 18.0,
      VELOCITY_Y_MIN: 5.0,
      VELOCITY_Y_MAX: 19.0,
      VELOCITY_Z_MAX: 8.0,
      ANGULAR_MAX: 12.0,
      Z_FORCE_CLAMP: 0.01,
      SCALE_DECAY_TIME: 1.5,
    }
  },
  EMISSIVE: {
    PLAYER_LERP_RATE: 0.18,
    PLAYER_EMISSIVE_SCALE: 0.2,
    WEAVER_EMISSIVE_SCALE: 0.4,
    WEAVER_EMISSIVE_PULSE_BASE: 0.05,
    WEAVER_EMISSIVE_PULSE_AMP: 0.04,
    WEAVER_EMISSIVE_PULSE_FREQ: 0.01,
  }
} as const;

export const POST_PROCESSING_PRESETS = {
  RENDERER: {
    SAMPLES: 4,
    BLOOM_THRESHOLD: 0.6,
    BLOOM_WEIGHT: 1.2,
    BLOOM_KERNEL: 64,
    VIGNETTE_WEIGHT: 2.8,
    EXPOSURE: 0.9,
    CONTRAST: 1.45,
    AMBIENT_LIGHT_INTENSITY: 0.08,
    DIR_LIGHT_INTENSITY: 3.2,
  },
  CAMERA: {
    DEFAULT_POS: { x: 0.0, y: 14.0, z: -38.0 },
    DEFAULT_TARGET: { x: 0.0, y: 14.0, z: 0.0 },
  }
} as const;
