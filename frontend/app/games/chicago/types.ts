/**
 * Types for Poker Chicago. Card/Suit/Rank from shared lib.
 */

import type { Rank } from "@/lib/cards";
export type { Card, Suit, Rank } from "@/lib/cards";
export { SUITS, RANKS } from "@/lib/cards";

export type PlayerId = "p1" | "p2";

/** Rank order: 2 low, ace high (for trick comparison). */
export const RANK_VALUE: Record<Rank, number> = {
  "2": 0,
  "3": 1,
  "4": 2,
  "5": 3,
  "6": 4,
  "7": 5,
  "8": 6,
  "9": 7,
  "10": 8,
  jack: 9,
  queen: 10,
  king: 11,
  ace: 12,
};
