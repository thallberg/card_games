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
  /** 2:or är valfritt kort: index i cards → vilket kort 2:an ska vara (och räknas som vid byggande). 2:an ger fortfarande 25 poäng. */
  wildRepresents?: Record<number, Card>;
  /** Spelare som lade ut melden (för poäng vid rundavslut). */
  ownerId?: string;
  /** Index i cards → spelare som lade till det kortet (addcardtomeld). Om saknas, räknas kortet till ownerId. */
  cardContributors?: Record<number, string>;
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
