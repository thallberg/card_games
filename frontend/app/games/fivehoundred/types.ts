/**
 * Base types for 500 (Five Hundred). Card/Suit/Rank from shared lib.
 */

import type { Card } from "@/lib/cards";
export type { Card, Suit, Rank } from "@/lib/cards";
export { SUITS, RANKS } from "@/lib/cards";

/** A laid combination: set (three/four of a kind) or run. */
export type Meld = {
  id: string;
  cards: Card[];
  type: "set" | "run";
  /** 2s are wild: index in cards → which card the 2 represents (for building). 2 still scores 25. */
  wildRepresents?: Record<number, Card>;
  /** Player who laid the meld (for scoring at round end). */
  ownerId?: string;
  /** Index in cards → player who added that card (addCardToMeld). If missing, counted as ownerId. */
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
