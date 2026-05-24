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
  }
} as const;
