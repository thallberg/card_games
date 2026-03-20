import type { Card, Rank } from "./types";
import type { GameState } from "./game-state";
import { RANK_VALUE } from "./types";

/** Giltigt stege: samma färg, på varandra följande valörer. Ett kort är ok. */
export function isValidStege(cards: Card[]): boolean {
  if (cards.length < 1) return false;
  if (cards.length === 1) return true;
  const suit = cards[0].suit;
  if (!cards.every((c) => c.suit === suit)) return false;
  const sorted = [...cards].sort((a, b) => RANK_VALUE[a.rank] - RANK_VALUE[b.rank]);
  for (let i = 1; i < sorted.length; i++) {
    if (RANK_VALUE[sorted[i].rank] !== RANK_VALUE[sorted[i - 1].rank] + 1) return false;
  }
  return true;
}

/** Kontrollera om kort bildar giltigt set (samma valör, 2–3 kort). */
export function isValidSet(cards: Card[]): boolean {
  if (cards.length < 2 || cards.length > 3) return false;
  const rank = cards[0].rank;
  return cards.every((c) => c.rank === rank);
}

/** Hitta längsta giltiga stege att leda med (1–n kort, samma färg följande valörer). */
export function findBestLead(hand: Card[]): { cards: Card[]; indices: number[] } {
  for (let len = Math.min(hand.length, 13); len >= 1; len--) {
    for (let i = 0; i <= hand.length - len; i++) {
      const slice = hand.slice(i, i + len);
      if (isValidStege(slice)) {
        const indices = slice.map((c) => hand.indexOf(c));
        return { cards: slice, indices };
      }
    }
  }
  const i = Math.floor(Math.random() * hand.length);
  return { cards: [hand[i]], indices: [i] };
}

/** Högsta valör i en uppsättning kort. */
export function highestRank(cards: Card[]): Rank {
  return cards.reduce(
    (best, c) => (RANK_VALUE[c.rank] > RANK_VALUE[best] ? c.rank : best),
    cards[0].rank
  );
}

/** Kontrollera om stege/set slår ledet (färg/trumf + valör). */
export function isMultiLegalToPlay(s: GameState, cards: Card[]): boolean {
  const leadSuit = s.trickLeadSuit!;
  const toBeat = s.trickHighRank!;
  const trumpSuit = s.trumpSuit;
  const tableTrick = s.tableTrick ?? [];

  const highestTrump = tableTrick
    .filter((tc) => tc.card.suit === trumpSuit)
    .reduce<Rank | null>((b, tc) => (!b || RANK_VALUE[tc.card.rank] > RANK_VALUE[b]) ? tc.card.rank : b, null);

  const myHigh = highestRank(cards);
  const myTrumps = cards.filter((c) => c.suit === trumpSuit);
  const myLeadSuit = cards.filter((c) => c.suit === leadSuit);

  if (myTrumps.length > 0 && leadSuit !== trumpSuit) return true;
  if (myTrumps.length > 0 && leadSuit === trumpSuit) {
    return !highestTrump || RANK_VALUE[myHigh] > RANK_VALUE[highestTrump];
  }
  if (myLeadSuit.length > 0) return RANK_VALUE[myHigh] > RANK_VALUE[toBeat];
  return false;
}

