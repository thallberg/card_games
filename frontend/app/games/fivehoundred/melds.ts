import type { Card, Meld } from "./types";
import { RANKS, SUITS } from "./types";

/** 2:or räknas som joker (valfri). */
export function isWild(card: Card): boolean {
  return card.rank === "2";
}

export const RANK_ORDER: Record<string, number> = {
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

const VALUE_TO_RANK: Record<number, string> = Object.fromEntries(
  RANKS.map((r, i) => [i, r])
) as Record<number, string>;

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
 * Möjliga kort som en 2:a får representera i en stege (hålen i följden).
 */
export function getWildOptionsForRun(cards: Card[]): Card[] {
  const rest = cards.filter((c) => !isWild(c));
  if (rest.length === 0) return [];
  const suit = rest[0].suit;
  const values = rest.map((c) => RANK_ORDER[c.rank]).sort((a, b) => a - b);
  const min = values[0];
  const max = values[values.length - 1];
  const options: Card[] = [];
  if (min > 0) options.push({ suit, rank: VALUE_TO_RANK[min - 1] as Card["rank"] });
  if (max < 12) options.push({ suit, rank: VALUE_TO_RANK[max + 1] as Card["rank"] });
  return options;
}

/**
 * Möjliga kort som en 2:a får representera i ett tretal/fyrtal (samma valör, saknad färg).
 */
export function getWildOptionsForSet(cards: Card[]): Card[] {
  const rest = cards.filter((c) => !isWild(c));
  if (rest.length === 0) return [];
  const rank = rest[0].rank as Card["rank"];
  const usedSuits = new Set(rest.map((c) => c.suit));
  return SUITS.filter((s) => !usedSuits.has(s)).map((suit) => ({ suit, rank }));
}

/**
 * Returnerar meldens kort så som spelet tolkar dem: 2:or ersatta med wildRepresents.
 * Används för logik (t.ex. "ligger dam redan där?") – inte bara visuellt.
 */
export function getEffectiveMeldCards(meld: Meld): Card[] {
  const wr = meld.wildRepresents;
  return meld.cards.map((c, i) => (wr && wr[i] ? wr[i] : c));
}

function cardEquals(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

function effectiveContains(effective: Card[], card: Card): boolean {
  return effective.some((c) => cardEquals(c, card));
}

/**
 * För stege: returnerar alla kort i ordning (2:or visas som valt kort om wildRepresents finns).
 * För tretal/fyrtal: returnerar alla kort (2:or med wildRepresents visas som valt kort).
 */
export function getMeldDisplayCards(meld: Meld): Card[] {
  const effective = getEffectiveMeldCards(meld);
  if (meld.type === "set") return effective;
  const nonWild = effective.filter((c) => !isWild(c));
  if (nonWild.length === 0) return effective;
  return [...effective].sort(
    (a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]
  );
}

/**
 * Kan ett kort läggas till på en befintlig meld?
 * 2:an räknas som det valda kortet – man får inte lägga "riktiga" dam om en 2 redan står som dam.
 * Set: samma valör, max 4 kort, färg får inte finnas redan (inkl. vad 2:or representerar).
 * Stege: samma färg, valör = min-1 eller max+1, kortet får inte redan finnas i melden.
 */
export function canAddCardToMeld(card: Card, meld: Meld): boolean {
  const effective = getEffectiveMeldCards(meld);
  if (meld.type === "set") {
    if (meld.cards.length >= 4) return false;
    if (isWild(card)) return true;
    if (effective.length === 0) return true;
    const rank = effective[0].rank;
    if (card.rank !== rank) return false;
    if (effectiveContains(effective, card)) return false;
    return true;
  }
  if (meld.type === "run") {
    if (effective.length === 0) return true;
    if (isWild(card)) return true;
    const suit = effective[0].suit;
    if (card.suit !== suit) return false;
    if (effectiveContains(effective, card)) return false;
    const values = effective.map((c) => RANK_ORDER[c.rank]).sort((a, b) => a - b);
    const min = values[0];
    const max = values[values.length - 1];
    const v = RANK_ORDER[card.rank];
    return v === min - 1 || v === max + 1;
  }
  return false;
}
