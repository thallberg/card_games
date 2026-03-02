import type { Card, Rank, Suit } from "./types";
import { SUITS, RANKS } from "./types";

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffle(deck: Card[]): Card[] {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function cardToFilename(card: Card): string {
  return `${card.rank}_of_${card.suit}.svg`;
}

export function sortHand(cards: Card[]): Card[] {
  const suitOrder: Record<Suit, number> = {
    hearts: 0, clubs: 1, diamonds: 2, spades: 3,
  };
  const rankOrder: Record<Rank, number> = {
    "2": 0, "3": 1, "4": 2, "5": 3, "6": 4, "7": 5, "8": 6, "9": 7,
    "10": 8, jack: 9, queen: 10, king: 11, ace: 12,
  };
  return [...cards].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit])
      return suitOrder[a.suit] - suitOrder[b.suit];
    return rankOrder[a.rank] - rankOrder[b.rank];
  });
}
