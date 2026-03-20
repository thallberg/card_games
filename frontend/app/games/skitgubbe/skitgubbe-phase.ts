import type { Card, PlayerId, Rank } from "./types";
import type { GameState } from "./game-state";
import { RANK_TO_REQUIRED_COUNT } from "./types";
import { sortHand, sortHandForPlay } from "./deck";

const LOW_RANKS: Rank[] = ["2", "3", "4", "5"];

/** Skitgubbe-regeln: spelare med färre plockade kort än sista kortets siffra får skiten. */
export function applySkitgubbeRule(
  s: GameState
): { hands: Record<PlayerId, Card[]>; skitgubbeIds: PlayerId[] } {
  const trumpRank = s.lastRevealedCard?.rank;
  const trumpSuit = s.trumpSuit;
  if (!trumpRank || !trumpSuit) return { hands: s.playerHands, skitgubbeIds: [] };

  const threshold = RANK_TO_REQUIRED_COUNT[trumpRank];
  const skitgubbeIds = s.playerIds.filter((id) => (s.wonCards?.[id] ?? []).length < threshold);
  if (skitgubbeIds.length === 0) return { hands: s.playerHands, skitgubbeIds: [] };

  const penaltyCards: Card[] = [];
  const newHands = { ...s.playerHands };

  for (const id of s.playerIds) {
    if (skitgubbeIds.includes(id)) continue;
    const hand = newHands[id] ?? [];
    const toGive = hand.filter(
      (c) => LOW_RANKS.includes(c.rank) || (c.suit === trumpSuit && c.rank === "6")
    );
    for (const c of toGive) penaltyCards.push(c);
    newHands[id] = hand.filter(
      (c) => !LOW_RANKS.includes(c.rank) && !(c.suit === trumpSuit && c.rank === "6")
    );
  }

  for (let i = 0; i < penaltyCards.length; i++) {
    const targetId = skitgubbeIds[i % skitgubbeIds.length];
    newHands[targetId] = sortHand([...(newHands[targetId] ?? []), penaltyCards[i]]);
  }

  return { hands: newHands, skitgubbeIds };
}

export function getSkitgubbePreviewData(
  s: GameState
): { skitgubbeIds: PlayerId[]; threshold: number } | null {
  const trumpRank = s.lastRevealedCard?.rank;
  if (!trumpRank) return null;
  const threshold = RANK_TO_REQUIRED_COUNT[trumpRank];
  const skitgubbeIds = s.playerIds.filter((id) => (s.wonCards?.[id] ?? []).length < threshold);
  return { skitgubbeIds, threshold };
}

export function getSkitgubbePlayerId(s: GameState): PlayerId | null {
  const data = getSkitgubbePreviewData(s);
  return data?.skitgubbeIds[0] ?? null;
}

/** Övergång skitgubbe-fas -> utspel. För multiplayer/singleplayer. */
export function continueToPlayState(s: GameState): GameState {
  if (s.phase !== "skitgubbe") return s;
  const handsWithWonCards: Record<PlayerId, Card[]> = {};
  for (const id of s.playerIds) {
    const hand = s.playerHands[id] ?? [];
    const won = s.wonCards?.[id] ?? [];
    handsWithWonCards[id] = [...hand, ...won];
  }
  const stateWithMergedHands = { ...s, playerHands: handsWithWonCards };
  const { hands, skitgubbeIds } = applySkitgubbeRule(stateWithMergedHands);
  const sortedHands: Record<string, Card[]> = {};
  for (const id of Object.keys(hands) as PlayerId[]) {
    sortedHands[id] = sortHandForPlay(hands[id] ?? [], s.trumpSuit);
  }
  return {
    ...s,
    playerHands: sortedHands as Record<PlayerId, Card[]>,
    skitgubbePlayerId: skitgubbeIds[0] ?? null,
    skitgubbePlayerIds: skitgubbeIds,
    phase: "play",
    tableTrick: [],
    trickLeader: s.lastStickWinner,
    trickLeadLength: 0,
    trickPlayLengths: [],
    trickLeadSuit: null,
    trickHighRank: null,
    trumpPlayedInTrick: false,
    trickShowingWinner: null,
    trickFighters: [],
    trickFightStartIndex: 0,
    currentPlayerId: s.lastStickWinner ?? s.playerIds[0],
  };
}

