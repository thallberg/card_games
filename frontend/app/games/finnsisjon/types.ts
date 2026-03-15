/**
 * Types for Finns i sjön (Go Fish). Card/Suit/Rank from shared lib.
 */

export type { Card, Suit, Rank } from "@/lib/cards";
export { SUITS, RANKS } from "@/lib/cards";

export type PlayerId = `p${number}`;

export const RANK_LABELS: Record<string, string> = {
  "2": "2", "3": "3", "4": "4", "5": "5", "6": "6",
  "7": "7", "8": "8", "9": "9", "10": "10",
  jack: "knekt", queen: "dam", king: "kung", ace: "ess",
};
