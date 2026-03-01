/**
 * Grundtyper för spelet 500 (Femhundra).
 */

export const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "jack",
  "queen",
  "king",
  "ace",
] as const;
export type Rank = (typeof RANKS)[number];

export type Card = {
  suit: Suit;
  rank: Rank;
};

/** En utlagd kombination: tretal/fyrtal eller stege. */
export type Meld = {
  id: string;
  cards: Card[];
  type: "set" | "run";
  /** För varje 2:a i cards: index i cards -> vilket kort den ska räknas som (visuellt). */
  wildRepresents?: Record<number, Card>;
};

export type PlayerId = string;

export type PlayerState = {
  id: PlayerId;
  name: string;
  hand: Card[];
  score: number;
};

export type GamePhase =
  | "dealing"
  | "playing"
  | "roundEnd"
  | "gameOver";
