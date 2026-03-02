import type { Card, Meld } from "./types";
import { RANKS, SUITS } from "./types";

/**
 * 2:or är wild (valfritt kort). Vid utläggning väljer spelaren vad 2:an ska vara.
 * 2:an ger alltid 25 poäng (se scoring.ts) men räknas som det valda kortet för kombinationen.
 */

export function isWild(card: Card): boolean {
  return card.rank === "2";
}

/** Valörordning i stegar: 2 låg, ess hög (t.ex. … knekt–dam–kung–ess). */
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

/** Ess som 1 (låg stege): ess–2–3. 2:an ger fortfarande 25 poäng. */
const RANK_ORDER_LOW: Record<string, number> = {
  ace: 0,
  "2": 1,
  "3": 2,
  "4": 3,
  "5": 4,
  "6": 5,
  "7": 6,
  "8": 7,
  "9": 8,
  "10": 9,
  jack: 10,
  queen: 11,
  king: 12,
};

const VALUE_TO_RANK: Record<number, string> = Object.fromEntries(
  RANKS.map((r, i) => [i, r])
) as Record<number, string>;

const VALUE_TO_RANK_LOW: Record<number, string> = {
  0: "ace", 1: "2", 2: "3", 3: "4", 4: "5", 5: "6", 6: "7", 7: "8", 8: "9",
  9: "10", 10: "jack", 11: "queen", 12: "king",
};

function getRunOrdering(cards: Card[]): "low" | "high" {
  const hasAce = cards.some((c) => c.rank === "ace");
  const has2 = cards.some((c) => c.rank === "2");
  if (hasAce && has2) return "low";
  return "high";
}

function runValues(cards: Card[], ordering: "low" | "high"): number[] {
  const order = ordering === "low" ? RANK_ORDER_LOW : RANK_ORDER;
  return cards.map((c) => order[c.rank]).filter((v): v is number => v !== undefined);
}

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
 * Giltig stege: samma färg, följd. Ess kan vara låg (ess–2–3) eller hög (…kung–ess).
 * 2:or är wild; 2:an ger fortfarande 25 poäng.
 */
export function isValidRun(cards: Card[]): boolean {
  if (cards.length < 3) return false;
  const wilds = cards.filter(isWild);
  const rest = cards.filter((c) => !isWild(c));
  if (rest.length === 0) return true;
  const suit = rest[0].suit;
  if (rest.some((c) => c.suit !== suit)) return false;

  const isConsecutive = (arr: number[]) => {
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] - arr[i - 1] !== 1) return false;
    }
    return true;
  };

  const tryOrdering = (ordering: "low" | "high") => {
    const values = runValues(rest, ordering).sort((a, b) => a - b);
    const n = values.length;
    const w = wilds.length;
    if (w === 0) return isConsecutive(values);
    const min = values[0];
    const max = values[n - 1];
    const span = max - min + 1;
    if (span > n + w) return false;
    const gaps = span - n;
    return gaps <= w;
  };

  const hasAce = rest.some((c) => c.rank === "ace");
  const has2 = rest.some((c) => c.rank === "2");
  if (hasAce && has2) return tryOrdering("low");
  if (hasAce) return tryOrdering("high");
  return tryOrdering("high");
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
 * Validerar att redan "effektiva" kort bildar en giltig stege (samma färg, följd, inga dubbletter).
 * Stödjer både ess–2–3 (låg) och …kung–ess (hög).
 */
export function isValidEffectiveRun(cards: Card[]): boolean {
  if (cards.length < 3) return false;
  const suit = cards[0].suit;
  if (cards.some((c) => c.suit !== suit)) return false;
  const ordering = getRunOrdering(cards);
  const values = runValues(cards, ordering).sort((a, b) => a - b);
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
 * Möjliga kort som en 2:a får representera i en stege (hål eller förlängning).
 * Stödjer låg stege (ess–2–3) och hög (…kung–ess).
 */
export function getWildOptionsForRun(cards: Card[]): Card[] {
  const rest = cards.filter((c) => !isWild(c));
  if (rest.length === 0) return [];
  const suit = rest[0].suit;
  const ordering = getRunOrdering(rest);
  const rankOrder = ordering === "low" ? RANK_ORDER_LOW : RANK_ORDER;
  const valueToRank = ordering === "low" ? VALUE_TO_RANK_LOW : VALUE_TO_RANK;
  const values = rest.map((c) => rankOrder[c.rank]).sort((a, b) => a - b);
  const min = values[0];
  const max = values[values.length - 1];
  const valueSet = new Set(values);
  const options: Card[] = [];
  if (min > 0) {
    const r = valueToRank[min - 1] as Card["rank"];
    if (r) options.push({ suit, rank: r });
  }
  for (let v = min; v <= max; v++) {
    if (!valueSet.has(v)) {
      const r = valueToRank[v] as Card["rank"];
      if (r) options.push({ suit, rank: r });
    }
  }
  if (max < 12) {
    const r = valueToRank[max + 1] as Card["rank"];
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
    const rep = (wr as Record<number, Card>)[i] ?? (wr as Record<string, Card>)[String(i)];
    if (rep && typeof rep === "object" && "suit" in rep && "rank" in rep) return rep;
    return c;
  });
}

/** True om meldens effektiva kort bildar en stege (låg ess–2–3 eller hög …kung–ess). */
export function isEffectiveRun(meld: Meld): boolean {
  const effective = getEffectiveMeldCards(meld);
  return isValidEffectiveRun(effective);
}

function cardEquals(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

function effectiveContains(effective: Card[], card: Card): boolean {
  return effective.some((c) => cardEquals(c, card));
}

/**
 * Kort att visa för en meld.
 * Stege med >3 kort: lägsta och högsta (t.ex. 3–9 visar 3 och 9).
 * Fyrtal (4 kort, inkl. 3+2:a): färdig – visa bara ett kort som hög.
 */
export function getMeldDisplayCards(meld: Meld): Card[] {
  const effective = getEffectiveMeldCards(meld);
  const asRun = meld.type === "run" || isEffectiveRun(meld);
  if (asRun) {
    const ordering = getRunOrdering(effective);
    const order = ordering === "low" ? RANK_ORDER_LOW : RANK_ORDER;
    const sorted = [...effective].sort((a, b) => order[a.rank] - order[b.rank]);
    if (sorted.length > 3) return [sorted[0], sorted[sorted.length - 1]];
    return sorted;
  }
  if (meld.cards.length >= 4) return [effective[0]];
  return effective;
}

/**
 * Kan kort läggas till på melden?
 * Stege: låg (ess–2–3→4) eller hög (…kung–ess). 2:an ger fortfarande 25 poäng.
 */
export function canAddCardToMeld(card: Card, meld: Meld): boolean {
  const effective = getEffectiveMeldCards(meld);
  const asRun = meld.type === "run" || isEffectiveRun(meld);
  if (!asRun) {
    if (meld.cards.length >= 4) return false;
    if (isWild(card)) return true;
    if (effective.length === 0) return true;
    const rankForSet = effective.find((c) => !isWild(c))?.rank ?? meld.cards.find((c) => !isWild(c))?.rank;
    if (!rankForSet || card.rank !== rankForSet) return false;
    if (effectiveContains(effective, card)) return false;
    return true;
  }
  if (effective.length === 0) return true;
  if (isWild(card)) return true;
  const suit = effective[0].suit;
  if (card.suit !== suit) return false;
  if (effectiveContains(effective, card)) return false;
  const ordering = getRunOrdering(effective);
  const order = ordering === "low" ? RANK_ORDER_LOW : RANK_ORDER;
  const values = runValues(effective, ordering).sort((a, b) => a - b);
  const min = values[0];
  const max = values[values.length - 1];
  const v = order[card.rank];
  if (v == null || v === undefined) return false;
  return v === min - 1 || v === max + 1;
}
