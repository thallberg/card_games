import type { Card, Rank, Suit } from "@/lib/cards";
import { RANKS, SUITS } from "@/lib/cards";

const SUIT_SET = new Set<string>(SUITS);
const RANK_SET = new Set<string>(RANKS);

/**
 * Normalizes raw API cards to the shared `{ suit, rank }` shape.
 * Supports both `suit/rank` and `Suit/Rank` keys.
 */
export function normalizeCard(raw: { suit?: unknown; rank?: unknown; Suit?: unknown; Rank?: unknown } | null | undefined): Card {
  const suitCandidate = (raw as any)?.suit ?? (raw as any)?.Suit;
  const rankCandidate = (raw as any)?.rank ?? (raw as any)?.Rank;

  const suit = SUIT_SET.has(String(suitCandidate ?? "")) ? (suitCandidate as Suit) : ("hearts" as Suit);
  const rank = RANK_SET.has(String(rankCandidate ?? "")) ? (rankCandidate as Rank) : ("2" as Rank);

  return { suit, rank };
}

export function normalizeCards(arr: unknown): Card[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((c) => normalizeCard(c as any));
}

