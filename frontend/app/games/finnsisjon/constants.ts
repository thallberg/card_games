/**
 * Game constants for Finns i sjön.
 */

export { CARD_IMAGE_BASE } from "@/lib/cards";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

/** Antal högar på bordet (1 öppet, 1+1, 2+1, ..., 6+1). */
export const TABLEAU_PILES = 7;

/** Kort per kvartett. */
export const CARDS_PER_QUARTET = 4;

/** Kort att plocka när handen är tom. */
export const DRAW_WHEN_EMPTY = 7;

/** Initial handstorlek (plockas från sjön efter att tableau lagts). */
export const INITIAL_HAND_SIZE = 7;
