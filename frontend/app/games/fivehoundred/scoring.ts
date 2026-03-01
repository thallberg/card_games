import type { Card } from "./types";

/**
 * Poäng per valör (vid utläggning).
 * Ess = 15, 2 = 20 (joker), 3–10 = 5, knekt/dam/kung = 10.
 */
const RANK_POINTS: Record<string, number> = {
  ace: 15,
  "2": 25,
  "3": 5,
  "4": 5,
  "5": 5,
  "6": 5,
  "7": 5,
  "8": 5,
  "9": 5,
  "10": 10,
  jack: 10,
  queen: 10,
  king: 10,
};

export function getCardPoints(card: Card): number {
  return RANK_POINTS[card.rank] ?? 0;
}

export function getMeldPoints(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + getCardPoints(c), 0);
}

/**
 * Minuspoäng för kvarvarande kort på handen när någon går ut.
 */
export function getHandPenalty(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + getCardPoints(c), 0);
}
