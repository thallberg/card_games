/**
 * Constants for Texas Hold'em.
 */

export { CARD_IMAGE_BASE } from "@/lib/cards";
import { GAME_PLAYER_LIMITS } from "@/lib/game-player-limits";

export const MIN_PLAYERS = GAME_PLAYER_LIMITS.texasholdem.min;
export const MAX_PLAYERS = GAME_PLAYER_LIMITS.texasholdem.max;

/** Minimum big blind (in units). */
export const MIN_BIG_BLIND = 1;

/** Default buy-in as multiple of big blind (e.g. 100 BB). */
export const DEFAULT_BUY_IN_BB = 100;
