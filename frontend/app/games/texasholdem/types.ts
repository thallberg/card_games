/**
 * Typer för Texas Hold'em.
 */

export const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = [
  "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "jack", "queen", "king", "ace",
] as const;
export type Rank = (typeof RANKS)[number];

export type Card = { suit: Suit; rank: Rank };

export type PlayerId = string;

export type BettingPhase = "preflop" | "flop" | "turn" | "river" | "showdown";

export type GamePhase = "setup" | "playing" | "handOver" | "gameOver";

export type PlayerSeat = {
  id: PlayerId;
  name: string;
  stack: number;
  /** Insats denna hand (för visning). */
  betThisHand: number;
  /** Har lagt in sin bet för nuvarande betting-runda. */
  actedThisRound: boolean;
  folded: boolean;
  isAllIn: boolean;
  /** Index i spelarlistan (0 = dealer i heads-up, annars dealer+1 = SB, +2 = BB). */
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
  /** Fem kort som utgör handen (sorterade för jämförelse). */
  cards: Card[];
  /** För tie-break: höga kort i ordning. */
  values: number[];
};
