import type { Card, Rank, Suit } from "@/lib/cards";
export {
  createDeck,
  shuffle,
  cardToFilename,
  sortHand,
} from "@/lib/cards";

/** Sort hand for play phase: by suit, rank order, trump last. Makes sequences visible. */
export function sortHandForPlay(
  cards: Card[],
  trumpSuit: Suit | null
): Card[] {
  const baseOrder: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
  const suitsForSort = trumpSuit
    ? [...baseOrder.filter((s) => s !== trumpSuit), trumpSuit]
    : baseOrder;
  const suitOrder: Record<Suit, number> = {} as Record<Suit, number>;
  suitsForSort.forEach((s, i) => {
    suitOrder[s] = i;
  });
  const rankOrder: Record<Rank, number> = {
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
  return [...cards].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit])
      return suitOrder[a.suit] - suitOrder[b.suit];
    return rankOrder[a.rank] - rankOrder[b.rank];
  });
}
