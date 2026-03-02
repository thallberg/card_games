import type { Card } from "./types";
import { RANK_VALUE } from "./types";
import { SUITS } from "./types";

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
