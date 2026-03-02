/**
 * Hjälp för AI: hitta en giltig meld i handen (set eller stege) som datorn kan lägga ut.
 */
import type { Card } from "./types";
import {
  isWild,
  isValidSet,
  isValidRun,
  getWildOptionsForSet,
  getWildOptionsForRun,
} from "./melds";

export type MeldChoice = {
  indices: number[];
  wildRepresents: Record<number, Card>;
};

function combine<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const result: T[][] = [];
  for (let i = 0; i <= arr.length - k; i++) {
    for (const tail of combine(arr.slice(i + 1), k - 1)) {
      result.push([arr[i], ...tail]);
    }
  }
  return result;
}

/**
 * Hittar första möjliga set (tretal/fyrtal) i handen.
 */
function findSetInHand(hand: Card[]): MeldChoice | null {
  const wildIndices: number[] = [];
  const byRank = new Map<string, number[]>();
  for (let i = 0; i < hand.length; i++) {
    if (isWild(hand[i])) wildIndices.push(i);
    else {
      const r = hand[i].rank;
      if (!byRank.has(r)) byRank.set(r, []);
      byRank.get(r)!.push(i);
    }
  }
  for (const [, indices] of byRank) {
    if (indices.length + wildIndices.length < 3) continue;
    const useWilds = Math.min(wildIndices.length, 4 - indices.length);
    const useRank = Math.min(indices.length, 4);
    const meldIndices = [
      ...indices.slice(0, useRank),
      ...wildIndices.slice(0, useWilds),
    ].slice(0, Math.max(3, Math.min(4, indices.length + useWilds)));
    if (meldIndices.length < 3) continue;
    const cards = meldIndices.map((i) => hand[i]);
    if (!isValidSet(cards)) continue;
    const rest = cards.filter((c) => !isWild(c));
    const options = getWildOptionsForSet(rest);
    const wildRepresents: Record<number, Card> = {};
    let optIdx = 0;
    for (let j = 0; j < cards.length; j++) {
      if (isWild(cards[j]) && options[optIdx]) {
        wildRepresents[j] = options[optIdx];
        optIdx++;
      }
    }
    return { indices: meldIndices, wildRepresents };
  }
  return null;
}

/**
 * Hittar första möjliga stege (3+ samma färg, följd) i handen.
 * Provar alla 3- och 4-kortskombinationer per färg (inkl. 2:or som wild).
 */
function findRunInHand(hand: Card[]): MeldChoice | null {
  const bySuit = new Map<string, number[]>();
  const wildIndices: number[] = [];
  for (let i = 0; i < hand.length; i++) {
    if (isWild(hand[i])) wildIndices.push(i);
    else {
      const suit = hand[i].suit;
      if (!bySuit.has(suit)) bySuit.set(suit, []);
      bySuit.get(suit)!.push(i);
    }
  }
  for (const [, suitIndices] of bySuit) {
    const group = [...suitIndices, ...wildIndices];
    if (group.length < 3) continue;
    for (const len of [3, 4, 5, 6, 7]) {
      if (group.length < len) break;
      for (const meldIndices of combine(group, len)) {
        const meldCards = meldIndices.map((i) => hand[i]);
        if (!isValidRun(meldCards)) continue;
        const rest = meldCards.filter((c) => !isWild(c));
        const options = getWildOptionsForRun(rest);
        const wildRepresents: Record<number, Card> = {};
        let optIdx = 0;
        for (let j = 0; j < meldCards.length; j++) {
          if (isWild(meldCards[j]) && options[optIdx]) {
            wildRepresents[j] = options[optIdx];
            optIdx++;
          }
        }
        return { indices: meldIndices, wildRepresents };
      }
    }
  }
  return null;
}

/**
 * Returnerar första giltiga meld (set eller stege) som kan bildas från handen.
 * indices är index i hand-arrayen; wildRepresents mappar position i melden för 2:or.
 */
export function findFirstPossibleMeld(hand: Card[]): MeldChoice | null {
  if (hand.length < 3) return null;
  const setChoice = findSetInHand(hand);
  if (setChoice) return setChoice;
  return findRunInHand(hand);
}
