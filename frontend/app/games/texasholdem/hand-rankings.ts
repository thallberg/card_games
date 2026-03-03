import type { Card, RankedHand } from "./types";
import { RANKS } from "./types";

const RANK_VALUES: Record<string, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
  jack: 11, queen: 12, king: 13, ace: 14,
};

export function rankValue(rank: string): number {
  return RANK_VALUES[rank] ?? 0;
}

function getValues(cards: Card[]): number[] {
  return cards.map((c) => rankValue(c.rank));
}

function countByRank(cards: Card[]): Map<number, Card[]> {
  const m = new Map<number, Card[]>();
  for (const c of cards) {
    const v = rankValue(c.rank);
    const list = m.get(v) ?? [];
    list.push(c);
    m.set(v, list);
  }
  return m;
}

function countBySuit(cards: Card[]): Map<string, Card[]> {
  const m = new Map<string, Card[]>();
  for (const c of cards) {
    const list = m.get(c.suit) ?? [];
    list.push(c);
    m.set(c.suit, list);
  }
  return m;
}

function isStraight(values: number[]): { isStraight: boolean; high: number } {
  const uniq = [...new Set(values)].sort((a, b) => b - a);
  const withAceLow = uniq.includes(14) ? [...uniq.filter((x) => x !== 14), 1] : [];
  for (const arr of [uniq, withAceLow]) {
    for (let i = 0; i <= arr.length - 5; i++) {
      let ok = true;
      for (let j = 1; j < 5; j++) {
        if (arr[i] - arr[i + j] !== j) {
          ok = false;
          break;
        }
      }
      if (ok) return { isStraight: true, high: arr[i] };
    }
  }
  return { isStraight: false, high: 0 };
}

/** Alla 21 sätt att välja 5 kort från 7. */
function choose5(cards: Card[]): Card[][] {
  const out: Card[][] = [];
  function go(start: number, chosen: Card[]) {
    if (chosen.length === 5) {
      out.push([...chosen]);
      return;
    }
    for (let i = start; i < cards.length; i++) {
      chosen.push(cards[i]);
      go(i + 1, chosen);
      chosen.pop();
    }
  }
  go(0, []);
  return out;
}

const HAND_ORDER: RankedHand["rank"][] = [
  "highCard", "pair", "twoPair", "threeOfAKind", "straight", "flush",
  "fullHouse", "fourOfAKind", "straightFlush", "royalFlush",
];

function rankHand(five: Card[]): RankedHand {
  const values = getValues(five).sort((a, b) => b - a);
  const byRank = countByRank(five);
  const bySuit = countBySuit(five);
  const counts = [...byRank.entries()].map(([v, list]) => [v, list.length] as [number, number]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flushSuit = [...bySuit.entries()].find(([, list]) => list.length >= 5)?.[0];
  const flushCards = flushSuit ? (bySuit.get(flushSuit) ?? []) : [];
  const { isStraight: isStr, high: straightHigh } = flushCards.length >= 5 ? isStraight(getValues(flushCards)) : isStraight(values);

  if (flushSuit && flushCards.length >= 5) {
    const flushVals = getValues(flushCards).sort((a, b) => b - a);
    const { isStraight: sf, high } = isStraight(flushVals);
    if (sf) {
      return {
        rank: high === 14 ? "royalFlush" : "straightFlush",
        cards: flushCards.slice(0, 5),
        values: [high],
      };
    }
    return {
      rank: "flush",
      cards: flushCards.slice(0, 5),
      values: getValues(flushCards).sort((a, b) => b - a).slice(0, 5),
    };
  }

  if (counts[0]?.[1] === 4) {
    const quadVal = counts[0][0];
    const kicker = counts[1]?.[0] ?? 0;
    const quadCards = (byRank.get(quadVal) ?? []).slice(0, 4);
    const rest = five.filter((c) => rankValue(c.rank) !== quadVal).sort((a, b) => rankValue(b.rank) - rankValue(a.rank))[0];
    return {
      rank: "fourOfAKind",
      cards: rest ? [...quadCards, rest] : quadCards,
      values: [quadVal, kicker],
    };
  }

  if (counts[0]?.[1] === 3 && counts[1]?.[1] === 2) {
    const tripVal = counts[0][0];
    const pairVal = counts[1][0];
    const tripCards = byRank.get(tripVal) ?? [];
    const pairCards = byRank.get(pairVal) ?? [];
    return {
      rank: "fullHouse",
      cards: [...tripCards, ...pairCards].slice(0, 5),
      values: [tripVal, pairVal],
    };
  }

  if (isStr) {
    const used = new Set<number>();
    const straightCards: Card[] = [];
    const all = [...five].sort((a, b) => rankValue(b.rank) - rankValue(a.rank));
    for (let v = straightHigh; v >= straightHigh - 4 && v >= 1; v--) {
      const c = all.find((x) => rankValue(x.rank) === v || (v === 1 && rankValue(x.rank) === 14));
      if (c && !used.has(rankValue(c.rank))) {
        straightCards.push(c);
        used.add(rankValue(c.rank));
      }
    }
    return {
      rank: "straight",
      cards: straightCards.length === 5 ? straightCards : five.slice(0, 5),
      values: [straightHigh],
    };
  }

  if (counts[0]?.[1] === 3) {
    const tripVal = counts[0][0];
    const kickers = five.filter((c) => rankValue(c.rank) !== tripVal).sort((a, b) => rankValue(b.rank) - rankValue(a.rank)).slice(0, 2);
    return {
      rank: "threeOfAKind",
      cards: [...(byRank.get(tripVal) ?? []), ...kickers].slice(0, 5),
      values: [tripVal, ...getValues(kickers)],
    };
  }

  if (counts[0]?.[1] === 2 && counts[1]?.[1] === 2) {
    const highPair = Math.max(counts[0][0], counts[1][0]);
    const lowPair = Math.min(counts[0][0], counts[1][0]);
    const kicker = counts[2]?.[0] ?? getValues(five).filter((v) => v !== highPair && v !== lowPair).sort((a, b) => b - a)[0] ?? 0;
    const cards = [...(byRank.get(highPair) ?? []), ...(byRank.get(lowPair) ?? []), ...five.filter((c) => rankValue(c.rank) !== highPair && rankValue(c.rank) !== lowPair)].slice(0, 5);
    return { rank: "twoPair", cards, values: [highPair, lowPair, kicker] };
  }

  if (counts[0]?.[1] === 2) {
    const pairVal = counts[0][0];
    const kickers = five.filter((c) => rankValue(c.rank) !== pairVal).sort((a, b) => rankValue(b.rank) - rankValue(a.rank)).slice(0, 3);
    return {
      rank: "pair",
      cards: [...(byRank.get(pairVal) ?? []), ...kickers].slice(0, 5),
      values: [pairVal, ...getValues(kickers)],
    };
  }

  return {
    rank: "highCard",
    cards: five.slice(0, 5),
    values: values.slice(0, 5),
  };
}

/** Bästa 5-kortshanden från 7 kort (2 hole + 5 board). */
export function bestHand(holeCards: Card[], board: Card[]): RankedHand {
  const all = [...holeCards, ...board];
  if (all.length < 5) return { rank: "highCard", cards: [], values: [] };
  const combos = all.length === 5 ? [all] : choose5(all);
  let best: RankedHand | null = null;
  for (const five of combos) {
    const r = rankHand(five);
    if (!best || compareRankedHands(r, best) > 0) best = r;
  }
  return best ?? { rank: "highCard", cards: [], values: [] };
}

export function compareRankedHands(a: RankedHand, b: RankedHand): number {
  const ia = HAND_ORDER.indexOf(a.rank);
  const ib = HAND_ORDER.indexOf(b.rank);
  if (ia !== ib) return ia - ib;
  const len = Math.max(a.values.length, b.values.length);
  for (let i = 0; i < len; i++) {
    const va = a.values[i] ?? 0;
    const vb = b.values[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

export function handRankLabel(rank: RankedHand["rank"]): string {
  const labels: Record<RankedHand["rank"], string> = {
    highCard: "Högsta kort",
    pair: "Ett par",
    twoPair: "Två par",
    threeOfAKind: "Triss",
    straight: "Stege",
    flush: "Färg",
    fullHouse: "Kåk",
    fourOfAKind: "Fyrtal",
    straightFlush: "Färgstege",
    royalFlush: "Royal flush",
  };
  return labels[rank] ?? rank;
}
