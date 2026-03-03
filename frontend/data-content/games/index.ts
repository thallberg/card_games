import type { GameCardData } from "./types";
import { texasholdemGameData } from "./texasholdem/data";
import { fivehoundredGameData } from "./fivehoundred/data";
import { chicagoGameData } from "./chicago/data";

/**
 * Alla kortspel som ska visas på framsidan.
 * Lägg till fler spel här när de finns i data-content/games/<spel>/data.ts.
 */
export const games: GameCardData[] = [
  texasholdemGameData,
  fivehoundredGameData,
  chicagoGameData,
];

export type { GameCardData } from "./types";
