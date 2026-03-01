import type { Card, Meld } from "./types";
import { RANKS } from "./types";

/** 2:or räknas som joker (valfri). */
export function isWild(card: Card): boolean {
  return card.rank === "2";
}

const RANK_ORDER: Record<string, number> = {
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

/**
 * Kontrollerar om kort kan bilda ett giltigt tretal/fyrtal (samma valör, 2 = joker).
 */
export function isValidSet(cards: Card[]): boolean {
  if (cards.length < 3 || cards.length > 4) return false;
  const wilds = cards.filter(isWild);
  const rest = cards.filter((c) => !isWild(c));
  if (rest.length === 0) return true;
  const rank = rest[0].rank;
  if (rest.some((c) => c.rank !== rank)) return false;
  return wilds.length + rest.length <= 4;
}

/**
 * Kontrollerar om kort kan bilda en giltig stege (samma färg, följd; ess som A-2-3 eller D-K-A).
 */
export function isValidRun(cards: Card[]): boolean {
  if (cards.length < 3) return false;
  const wilds = cards.filter(isWild);
  const rest = cards.filter((c) => !isWild(c));
  if (rest.length === 0) return true;
  const suit = rest[0].suit;
  if (rest.some((c) => c.suit !== suit)) return false;

  const values = rest.map((c) => RANK_ORDER[c.rank]).sort((a, b) => a - b);
  const n = values.length;
  const w = wilds.length;

  const isConsecutive = (arr: number[]) => {
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] - arr[i - 1] !== 1) return false;
    }
    return true;
  };

  if (w === 0) {
    if (values[0] === 0 && values[n - 1] === 12) {
      return false;
    }
    return isConsecutive(values);
  }

  const min = values[0];
  const max = values[n - 1];
  const span = max - min + 1;
  if (span > n + w) return false;
  const gaps = span - n;
  return gaps <= w;
}

export function isValidMeld(cards: Card[]): boolean {
  return isValidSet(cards) || isValidRun(cards);
}

export function getMeldType(cards: Card[]): "set" | "run" | null {
  if (isValidSet(cards)) return "set";
  if (isValidRun(cards)) return "run";
  return null;
}

/**
 * För stege: returnerar [lägsta kort, högsta kort] så man ser vad man kan bygga på.
 * För tretal/fyrtal: returnerar alla kort.
 */
export function getMeldDisplayCards(meld: Meld): Card[] {
  if (meld.type === "set") return meld.cards;
  const nonWild = meld.cards.filter((c) => !isWild(c));
  if (nonWild.length === 0) return meld.cards;
  const sorted = [...nonWild].sort(
    (a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]
  );
  const low = sorted[0];
  const high = sorted[sorted.length - 1];
  return low === high ? [low] : [low, high];
}

/**
 * Kan ett kort läggas till på en befintlig meld?
 * Set: samma valör (eller joker), max 4 kort.
 * Stege: samma färg, valör = min-1 eller max+1 (ess lågt/högt).
 */
export function canAddCardToMeld(card: Card, meld: Meld): boolean {
  if (meld.type === "set") {
    if (meld.cards.length >= 4) return false;
    if (isWild(card)) return true;
    const nonWild = meld.cards.filter((c) => !isWild(c));
    if (nonWild.length === 0) return true;
    return nonWild[0].rank === card.rank;
  }
  if (meld.type === "run") {
    const nonWild = meld.cards.filter((c) => !isWild(c));
    if (nonWild.length === 0) return true;
    if (isWild(card)) return true;
    const suit = nonWild[0].suit;
    if (card.suit !== suit) return false;
    const values = nonWild.map((c) => RANK_ORDER[c.rank]).sort((a, b) => a - b);
    const min = values[0];
    const max = values[values.length - 1];
    const v = RANK_ORDER[card.rank];
    return v === min - 1 || v === max + 1;
  }
  return false;
}
