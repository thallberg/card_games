/**
 * Game constants for Finns i sjön.
 */

export { CARD_IMAGE_BASE } from "@/lib/cards";
import { GAME_HAND_SIZES } from "@/lib/game-hand-sizes";
import { GAME_PLAYER_LIMITS } from "@/lib/game-player-limits";

export const MIN_PLAYERS = GAME_PLAYER_LIMITS.finnsisjon.min;
export const MAX_PLAYERS = GAME_PLAYER_LIMITS.finnsisjon.max;

/** Antal högar på bordet (1 öppet, 1+1, 2+1, ..., 6+1). */
export const TABLEAU_PILES = 7;

/** Kort per kvartett. */
export const CARDS_PER_QUARTET = 4;

/** Kort att plocka när handen är tom. */
export const DRAW_WHEN_EMPTY = 7;

/** Initial handstorlek (plockas från sjön efter att tableau lagts). */
export const INITIAL_HAND_SIZE = GAME_HAND_SIZES.finnsisjon.initial;
