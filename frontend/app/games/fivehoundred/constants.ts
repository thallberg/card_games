/**
 * Game constants for 500.
 */

export { CARD_IMAGE_BASE } from "@/lib/cards";
import { GAME_HAND_SIZES } from "@/lib/game-hand-sizes";

/** Points to win the match. */
export const POINTS_TO_WIN = 500;

/** Cards per player in hand (Swedish variant). */
export const HAND_SIZE = GAME_HAND_SIZES.fivehoundred;

/** Penalty points if you pick up the discard pile but don't lay at least 3 cards that turn. */
export const PICKUP_PENALTY = 50;
