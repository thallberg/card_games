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
