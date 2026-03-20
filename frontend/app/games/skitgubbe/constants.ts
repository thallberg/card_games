/**
 * Game constants for Skitgubbe.
 */

export { CARD_IMAGE_BASE } from "@/lib/cards";
import { GAME_HAND_SIZES } from "@/lib/game-hand-sizes";
import { GAME_PLAYER_LIMITS } from "@/lib/game-player-limits";

export const MIN_PLAYERS = GAME_PLAYER_LIMITS.skitgubbe.min;
export const MAX_PLAYERS = GAME_PLAYER_LIMITS.skitgubbe.max;

/** Cards per player in phase 1 (stick phase). */
export const HAND_SIZE_PHASE1 = GAME_HAND_SIZES.skitgubbe.phase1;
