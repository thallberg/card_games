/**
 * Typer för Poker Chicago.
 */

export const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = [
  "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "jack", "queen", "king", "ace",
] as const;
export type Rank = (typeof RANKS)[number];

export type Card = {
  suit: Suit;
  rank: Rank;
};

export type PlayerId = "p1" | "p2";

/** Rangordning: 2 låg, ess hög (för stick). */
export const RANK_VALUE: Record<Rank, number> = {
  "2": 0, "3": 1, "4": 2, "5": 3, "6": 4, "7": 5, "8": 6, "9": 7,
  "10": 8, jack: 9, queen: 10, king: 11, ace: 12,
};
