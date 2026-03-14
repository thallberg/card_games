/**
 * Types for Texas Hold'em. Card/Suit/Rank from shared lib.
 */

import type { Card } from "@/lib/cards";
export type { Card, Suit, Rank } from "@/lib/cards";
export { SUITS, RANKS } from "@/lib/cards";

export type PlayerId = string;

export type BettingPhase = "preflop" | "flop" | "turn" | "river" | "showdown";

export type GamePhase = "setup" | "playing" | "handOver" | "gameOver";

export type PlayerSeat = {
  id: PlayerId;
  name: string;
  stack: number;
  /** Bet this hand (for display). */
  betThisHand: number;
  /** Has posted bet for current betting round. */
  actedThisRound: boolean;
  folded: boolean;
  isAllIn: boolean;
  /** Index in player list (0 = dealer in heads-up, else dealer+1 = SB, +2 = BB). */
  seatIndex: number;
};

export type HandRank =
  | "highCard"
  | "pair"
  | "twoPair"
  | "threeOfAKind"
  | "straight"
  | "flush"
  | "fullHouse"
  | "fourOfAKind"
  | "straightFlush"
  | "royalFlush";

export type RankedHand = {
  rank: HandRank;
  /** Five cards that form the hand (sorted for comparison). */
  cards: Card[];
  /** For tie-break: high cards in order. */
  values: number[];
};
