/**
 * Backend GameTypeDto: 2=FiveHundred, 3=Chicago, 4=TexasHoldem, 5=Skitgubbe, 6=FinnsISjon.
 * Mappar spel-id (från data-content/games) till backend gameType.
 */
export type BackendGameType = 2 | 3 | 4 | 5 | 6;

export const GAME_ID_TO_BACKEND_TYPE: Record<string, BackendGameType> = {
  fivehoundred: 2,
  chicago: 3,
  texasholdem: 4,
  skitgubbe: 5,
  finnsisjon: 6,
};

export function getGameTypeFromId(gameId: string): BackendGameType {
  return GAME_ID_TO_BACKEND_TYPE[gameId] ?? 2; // default 500
}
