/**
 * Backend GameTypeDto: 2=FiveHundred, 3=Chicago, 4=TexasHoldem, 5=Skitgubbe.
 * Mappar spel-id (från data-content/games) till backend gameType.
 */
export const GAME_ID_TO_BACKEND_TYPE: Record<string, number> = {
  fivehoundred: 2,
  chicago: 3,
  texasholdem: 4,
  skitgubbe: 5,
};

export function getGameTypeFromId(gameId: string): number {
  return GAME_ID_TO_BACKEND_TYPE[gameId] ?? 2; // default 500
}
