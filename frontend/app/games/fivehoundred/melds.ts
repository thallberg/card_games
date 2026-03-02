import type { Card, Meld } from "./types";
import { RANKS, SUITS } from "./types";

/**
 * 2:or är wild (valfritt kort). Vid utläggning väljer spelaren vad 2:an ska vara.
 * 2:an ger alltid 25 poäng (se scoring.ts) men räknas som det valda kortet för kombinationen.
 */

export function isWild(card: Card): boolean {
  return card.rank === "2";
}

/** Valörordning i stegar: 2 låg, ess hög. */
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
 * Giltigt tretal/fyrtal: samma valör, 2 = wild (välj valör vid utläggning).
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
 * Giltig stege: samma färg, följd (2–3–4… eller …10–knekt–dam–kung–ess).
 * 2:or är wild: man väljer vid utläggning vilket kort 2:an ska vara (t.ex. ruter 3,4,5,6 och 2 som ruter 7).
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
 * Validerar att redan "effektiva" kort (2:or ersatta med val) bildar en giltig stege (samma färg, följd, inga dubbletter).
 */
export function isValidEffectiveRun(cards: Card[]): boolean {
  if (cards.length < 3) return false;
  const suit = cards[0].suit;
  if (cards.some((c) => c.suit !== suit)) return false;
  const values = cards.map((c) => RANK_ORDER[c.rank]).sort((a, b) => a - b);
  const seen = new Set<number>();
  for (const v of values) {
    if (seen.has(v)) return false;
    seen.add(v);
  }
  for (let i = 1; i < values.length; i++) {
    if (values[i] - values[i - 1] !== 1) return false;
  }
  return true;
}

/**
 * Validerar att redan "effektiva" kort bildar ett giltigt tretal/fyrtal (samma valör, olika färger).
 */
export function isValidEffectiveSet(cards: Card[]): boolean {
  if (cards.length < 3 || cards.length > 4) return false;
  const rank = cards[0].rank;
  const suits = new Set(cards.map((c) => c.suit));
  return cards.every((c) => c.rank === rank) && suits.size === cards.length;
}

/**
 * Möjliga kort som en 2:a får representera i en stege: hål i följden eller förlängning under/över.
 * T.ex. ruter 3,4,5,6 + 2 → 2 kan vara ruter 2 eller ruter 7.
 * Ruter 4,5,6,7,8,9 + 2 → 2 kan vara ruter 3 eller ruter 10 (sedan kan man bygga med knekt på 2:an som 10).
 */
export function getWildOptionsForRun(cards: Card[]): Card[] {
  const rest = cards.filter((c) => !isWild(c));
  if (rest.length === 0) return [];
  const suit = rest[0].suit;
  const values = rest.map((c) => RANK_ORDER[c.rank]).sort((a, b) => a - b);
  const min = values[0];
  const max = values[values.length - 1];
  const valueSet = new Set(values);
  const options: Card[] = [];
  if (min > 0) {
    const r = VALUE_TO_RANK[min - 1] as Card["rank"];
    if (r) options.push({ suit, rank: r });
  }
  for (let v = min; v <= max; v++) {
    if (!valueSet.has(v)) {
      const r = VALUE_TO_RANK[v] as Card["rank"];
      if (r) options.push({ suit, rank: r });
    }
  }
  if (max < 12) {
    const r = VALUE_TO_RANK[max + 1] as Card["rank"];
    if (r) options.push({ suit, rank: r });
  }
  return options;
}

/**
 * Möjliga kort som en 2:a får representera i tretal/fyrtal: samma valör, saknad färg.
 */
export function getWildOptionsForSet(cards: Card[]): Card[] {
  const rest = cards.filter((c) => !isWild(c));
  if (rest.length === 0) return [];
  const rank = rest[0].rank as Card["rank"];
  const usedSuits = new Set(rest.map((c) => c.suit));
  return SUITS.filter((s) => !usedSuits.has(s)).map((suit) => ({ suit, rank }));
}

/**
 * Melden som spelet tolkar den: 2:or ersatta med wildRepresents.
 * Används för att avgöra vad som "ligger" i stegen (t.ex. kan jag lägga ruter 6 på 2:an som ruter 5?).
 * 2:an ger fortfarande 25 poäng – här handlar det bara om vilket kort den *äger* som i kombinationen.
 */
export function getEffectiveMeldCards(meld: Meld): Card[] {
  const wr = meld.wildRepresents;
  if (!wr || typeof wr !== "object") return [...meld.cards];
  return meld.cards.map((c, i) => {
    const key = i as keyof typeof wr;
    const rep = wr[key] ?? (wr as Record<string, Card>)[String(i)];
    return rep ? rep : c;
  });
}

/** True om meldens effektiva kort bildar en stege. */
export function isEffectiveRun(meld: Meld): boolean {
  const effective = getEffectiveMeldCards(meld);
  if (effective.length < 3) return false;
  const suit = effective[0].suit;
  if (effective.some((c) => c.suit !== suit)) return false;
  const values = effective.map((c) => RANK_ORDER[c.rank]).sort((a, b) => a - b);
  for (let i = 1; i < values.length; i++) {
    if (values[i] - values[i - 1] !== 1) return false;
  }
  return true;
}

function cardEquals(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

function effectiveContains(effective: Card[], card: Card): boolean {
  return effective.some((c) => cardEquals(c, card));
}

/**
 * Kort att visa för en meld. Stege med >3 kort: första och sista (t.ex. ruter 3…9).
 * 2:or visas som det valda kortet (effektivt) så att det syns hur man kan bygga vidare.
 */
export function getMeldDisplayCards(meld: Meld): Card[] {
  const effective = getEffectiveMeldCards(meld);
  const asRun = meld.type === "run" || isEffectiveRun(meld);
  if (!asRun) return effective;
  const sorted = [...effective].sort(
    (a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]
  );
  if (sorted.length > 3) return [sorted[0], sorted[sorted.length - 1]];
  return sorted;
}

/**
 * Kan kort läggas till på melden?
 * 2:or räknas som det valda kortet (wildRepresents): man kan bygga på 2:an som om den vore det kortet
 * (t.ex. 2 som ruter 5 → man får lägga ruter 6 på den). 2:an ger fortfarande 25 poäng.
 */
export function canAddCardToMeld(card: Card, meld: Meld): boolean {
  const effective = getEffectiveMeldCards(meld);
  const asRun = meld.type === "run" || isEffectiveRun(meld);
  if (!asRun) {
    if (meld.cards.length >= 4) return false;
    if (isWild(card)) return true;
    if (effective.length === 0) return true;
    const rank = effective[0].rank;
    if (card.rank !== rank) return false;
    if (effectiveContains(effective, card)) return false;
    return true;
  }
  if (effective.length === 0) return true;
  if (isWild(card)) return true;
  const suit = effective[0].suit;
  if (card.suit !== suit) return false;
  if (effectiveContains(effective, card)) return false;
  const values = effective.map((c) => RANK_ORDER[c.rank]).sort((a, b) => a - b);
  const min = values[0];
  const max = values[values.length - 1];
  const v = RANK_ORDER[card.rank];
  if (v == null || v === undefined) return false;
  return v === min - 1 || v === max + 1;
}
