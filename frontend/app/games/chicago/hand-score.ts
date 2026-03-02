import type { Card } from "./types";
import { RANK_VALUE } from "./types";

export type HandEvaluation = {
  /** Samma skala som getHandPoints: 0–8 (högsta kort … stege i färg). */
  rank: number;
  /** Tie-breaker: vid samma handtyp jämförs dessa (högst par, högst triss, stegets topp osv). */
  tieBreaker: number[];
};

function byValue(cards: Card[]): number[] {
  return cards.map((c) => RANK_VALUE[c.rank]).sort((a, b) => b - a);
}

function rankCounts(cards: Card[]): { value: number; count: number }[] {
  const map = new Map<number, number>();
  for (const c of cards) {
    const v = RANK_VALUE[c.rank];
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);
}

/** Högsta valör i stegen, eller null. Wheel A-2-3-4-5 ger 3 (5 hög). */
function straightHigh(values: number[]): number | null {
  if (values.length < 5) return null;
  const uniq = [...new Set(values)].sort((a, b) => b - a);
  for (let i = 0; i <= uniq.length - 5; i++) {
    const slice = uniq.slice(i, i + 5);
    if (slice[0] - slice[slice.length - 1] === 4) return slice[0];
  }
  if (uniq.includes(12) && uniq.includes(0) && uniq.includes(1) && uniq.includes(2) && uniq.includes(3)) return 3;
  return null;
}

function isFlush(cards: Card[]): boolean {
  if (cards.length < 5) return false;
  const suit = cards[0].suit;
  return cards.every((c) => c.suit === suit);
}

/**
 * Utvärderar hand för jämförelse: rank (0–8) och tieBreaker.
 * Vid lika handtyp vinner den med högre tieBreaker (högst par, högst triss, högst stege osv).
 */
export function evaluateHand(cards: Card[]): HandEvaluation {
  if (cards.length !== 5) return { rank: -1, tieBreaker: byValue(cards) };
  const values = cards.map((c) => RANK_VALUE[c.rank]);
  const sorted = [...values].sort((a, b) => b - a);
  const rc = rankCounts(cards);
  const strHigh = straightHigh(sorted);
  const flush = isFlush(cards);

  if (flush && strHigh !== null) return { rank: 8, tieBreaker: [strHigh] };
  if (rc[0].count === 4) return { rank: 7, tieBreaker: [rc[0].value, ...rc.slice(1).map((r) => r.value)] };
  if (rc[0].count === 3 && rc[1].count === 2) return { rank: 6, tieBreaker: [rc[0].value, rc[1].value] };
  if (flush) return { rank: 5, tieBreaker: sorted };
  if (strHigh !== null) return { rank: 4, tieBreaker: [strHigh] };
  if (rc[0].count === 3) {
    const kickers = rc.slice(1).map((r) => r.value).sort((a, b) => b - a);
    return { rank: 3, tieBreaker: [rc[0].value, ...kickers] };
  }
  if (rc[0].count === 2 && rc[1].count === 2) {
    const highPair = Math.max(rc[0].value, rc[1].value);
    const lowPair = Math.min(rc[0].value, rc[1].value);
    return { rank: 2, tieBreaker: [highPair, lowPair, rc[2]?.value ?? 0] };
  }
  if (rc[0].count === 2) {
    const kickers = rc.slice(1).map((r) => r.value).sort((a, b) => b - a);
    return { rank: 1, tieBreaker: [rc[0].value, ...kickers] };
  }
  return { rank: 0, tieBreaker: sorted };
}

/**
 * Jämför två händer. Returnerar: -1 om handA vinner, 1 om handB vinner, 0 vid lika.
 * Vid samma handtyp (båda par, båda triss osv.) vinner den med högst valör (högst par, högst triss, högst stege).
 */
export function compareHands(handA: Card[], handB: Card[]): -1 | 0 | 1 {
  const evA = evaluateHand(handA);
  const evB = evaluateHand(handB);
  if (evA.rank !== evB.rank) return evA.rank > evB.rank ? -1 : 1;
  const len = Math.max(evA.tieBreaker.length, evB.tieBreaker.length);
  for (let i = 0; i < len; i++) {
    const a = evA.tieBreaker[i] ?? 0;
    const b = evB.tieBreaker[i] ?? 0;
    if (a !== b) return a > b ? -1 : 1;
  }
  return 0;
}

/**
 * Poäng för handen (par, triss, färg etc.) – används efter utspelet.
 */
export function getHandPoints(cards: Card[]): number {
  if (cards.length !== 5) return 0;
  const byRank: Record<string, number> = {};
  const bySuit: Record<string, number> = {};
  for (const c of cards) {
    byRank[c.rank] = (byRank[c.rank] ?? 0) + 1;
    bySuit[c.suit] = (bySuit[c.suit] ?? 0) + 1;
  }
  const counts = Object.values(byRank).sort((a, b) => b - a);
  const suitCounts = Object.values(bySuit);

  if (suitCounts.some((n) => n >= 5)) {
    const values = cards.map((c) => RANK_VALUE[c.rank]).sort((a, b) => a - b);
    const isStraight = values[4] - values[0] === 4 || (values[0] === 0 && values[4] === 12);
    if (isStraight) return 8;
    return 5;
  }
  if (counts[0] === 4) return 7;
  if (counts[0] === 3 && counts[1] === 2) return 6;
  if (counts[0] === 3) return 3;
  if (counts[0] === 2 && counts[1] === 2) return 2;
  if (counts[0] === 2) return 1;
  return 0;
}

export function getHandDescription(cards: Card[]): string {
  const p = getHandPoints(cards);
  if (p >= 8) return "Stege i färg";
  if (p >= 7) return "Fyrtal";
  if (p >= 6) return "Kåk";
  if (p >= 5) return "Färg";
  if (p >= 3) return "Triss";
  if (p >= 2) return "Två par";
  if (p >= 1) return "Par";
  return "Ingen";
}

/** Index (0..4) för kort som ingår i handens poängkombination (par, triss, färg osv.). */
export function getHandHighlightIndices(cards: Card[]): Set<number> {
  const indices = new Set<number>();
  if (cards.length !== 5) return indices;
  const byRank: Record<string, number[]> = {};
  const bySuit: Record<string, number[]> = {};
  cards.forEach((c, i) => {
    if (!byRank[c.rank]) byRank[c.rank] = [];
    byRank[c.rank].push(i);
    if (!bySuit[c.suit]) bySuit[c.suit] = [];
    bySuit[c.suit].push(i);
  });
  const rankGroups = Object.values(byRank).sort((a, b) => b.length - a.length);
  const suitGroups = Object.values(bySuit);

  if (suitGroups.some((g) => g.length >= 5)) {
    cards.forEach((_, i) => indices.add(i));
    return indices;
  }
  if (rankGroups[0]?.length === 4) {
    rankGroups[0].forEach((i) => indices.add(i));
    return indices;
  }
  if (rankGroups[0]?.length === 3 && rankGroups[1]?.length === 2) {
    rankGroups[0].forEach((i) => indices.add(i));
    rankGroups[1].forEach((i) => indices.add(i));
    return indices;
  }
  if (rankGroups[0]?.length === 3) {
    rankGroups[0].forEach((i) => indices.add(i));
    return indices;
  }
  if (rankGroups[0]?.length === 2 && rankGroups[1]?.length === 2) {
    rankGroups[0].forEach((i) => indices.add(i));
    rankGroups[1].forEach((i) => indices.add(i));
    return indices;
  }
  if (rankGroups[0]?.length === 2) {
    rankGroups[0].forEach((i) => indices.add(i));
    return indices;
  }
  return indices;
}
