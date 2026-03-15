import type { Card } from "@/lib/cards";
export {
  createDeck,
  shuffle,
  cardToFilename,
  sortHand,
} from "@/lib/cards";

/** Sortera hand efter valör (gruppera kvartetter). */
export function sortHandByRank(cards: Card[]): Card[] {
  const rankOrder: Record<string, number> = {
    "2": 0, "3": 1, "4": 2, "5": 3, "6": 4, "7": 5,
    "8": 6, "9": 7, "10": 8, jack: 9, queen: 10, king: 11, ace: 12,
  };
  return [...cards].sort((a, b) => rankOrder[a.rank] - rankOrder[b.rank]);
}
