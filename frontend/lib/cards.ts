/**
 * Shared playing card types, constants, and deck utilities for all card games.
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

/** Base URL for card images (SVG assets in public). */
export const CARD_IMAGE_BASE = "/playing-cards/svg-cards";

/** Create a standard 52-card deck (no jokers). */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/** Fisher–Yates shuffle. */
export function shuffle(deck: Card[]): Card[] {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Filename for a card (matches SVG assets). E.g. { suit: "hearts", rank: "2" } -> "2_of_hearts.svg" */
export function cardToFilename(card: Card): string {
  return `${card.rank}_of_${card.suit}.svg`;
}

/** Sort hand for display: suit order (hearts, clubs, diamonds, spades), then rank low to high. */
export function sortHand(cards: Card[]): Card[] {
  const suitOrder: Record<Suit, number> = {
    hearts: 0,
    clubs: 1,
    diamonds: 2,
    spades: 3,
  };
  const rankOrder: Record<Rank, number> = {
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
  return [...cards].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit])
      return suitOrder[a.suit] - suitOrder[b.suit];
    return rankOrder[a.rank] - rankOrder[b.rank];
  });
}
