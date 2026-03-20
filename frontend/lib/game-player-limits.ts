export const DEFAULT_MIN_PLAYERS = 2;
export const DEFAULT_MAX_PLAYERS = 6;

export const GAME_PLAYER_LIMITS = {
  finnsisjon: { min: DEFAULT_MIN_PLAYERS, max: DEFAULT_MAX_PLAYERS },
  skitgubbe: { min: DEFAULT_MIN_PLAYERS, max: DEFAULT_MAX_PLAYERS },
  texasholdem: { min: DEFAULT_MIN_PLAYERS, max: DEFAULT_MAX_PLAYERS },
} as const;

