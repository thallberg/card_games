/**
 * Types for Skitgubbe. Card/Suit/Rank from shared lib.
 */

import type { Rank } from "@/lib/cards";
export type { Card, Suit, Rank } from "@/lib/cards";
export { SUITS, RANKS } from "@/lib/cards";

export type PlayerId = `p${number}`;

/** Rank order: 2 low, ace high (for stick comparison). */
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

/** Required number of won cards for skitgubbe penalty: last card's value (2→2 … 10→10, jack→11, queen→12, king→13, ace→14). */
export const RANK_TO_REQUIRED_COUNT: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  jack: 11,
  queen: 12,
  king: 13,
  ace: 14,
};
