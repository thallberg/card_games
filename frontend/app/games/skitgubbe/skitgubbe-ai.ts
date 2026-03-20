import type { Card, PlayerId, Rank } from "./types";
import type { GameState } from "./game-state";
import { RANK_VALUE } from "./types";
import { findBestLead, highestRank, isMultiLegalToPlay, isValidStege } from "./skitgubbe-trick-logic";

export type AiStickMove =
  | {
      kind: "hand" | "stock";
      aiId: PlayerId;
      card: Card;
      /** -1 means "from stock" (don't remove from hand). */
      handIndex: number;
      newStock?: Card[];
    }
  | null;

export type AiTrickMove =
  | { kind: "trickCard"; aiId: PlayerId; card: Card; handIndex: number }
  | { kind: "trickCards"; aiId: PlayerId; cards: Card[]; handIndices: number[] }
  | { kind: "pickupTrick"; aiId: PlayerId }
  | null;

export function getAiStickMove(state: GameState, humanPlayerId: PlayerId): AiStickMove {
  const aiId = state.currentPlayerId;
  if (!aiId || aiId === humanPlayerId) return null;

  const hand = state.playerHands[aiId] ?? [];
  let card: Card | null = null;
  let handIndex = -1;

  if (state.stickLedRank !== null) {
    if (state.playersMustPlay.includes(aiId)) {
      const idx = hand.findIndex((c) => c.rank === state.stickLedRank);
      if (idx >= 0) {
        card = hand[idx];
        handIndex = idx;
      }
    } else if (state.stickFighters.includes(aiId)) {
      const playedByAi = state.tableStick.filter((sc) => sc.playerId === aiId).length;
      if (playedByAi === 1 && hand.length > 0) {
        const idx = Math.floor(Math.random() * hand.length);
        card = hand[idx];
        handIndex = idx;
      }
    }
  }

  if (!card && hand.length > 0) {
    const idx = Math.floor(Math.random() * hand.length);
    card = hand[idx];
    handIndex = idx;
  }

  if (!card) {
    if (state.stock.length > 0) {
      const stockCard = state.stock[state.stock.length - 1];
      const newStock = state.stock.slice(0, -1);
      return { kind: "stock", aiId, card: stockCard, handIndex: -1, newStock };
    }
    return null;
  }

  return { kind: "hand", aiId, card, handIndex };
}

export function getAiTrickMove(state: GameState, humanPlayerId: PlayerId): AiTrickMove {
  const aiId = state.currentPlayerId;
  if (!aiId || aiId === humanPlayerId) return null;

  const hand = state.playerHands[aiId] ?? [];
  if (hand.length === 0) return null;

  const toBeat = state.trickHighRank;
  const leadSuit = state.trickLeadSuit;
  const trumpSuit = state.trumpSuit;
  const tableTrick = state.tableTrick ?? [];

  const highestTrump = tableTrick
    .filter((tc) => tc.card.suit === trumpSuit)
    .reduce<Rank | null>((b, tc) => (!b || RANK_VALUE[tc.card.rank] > RANK_VALUE[b]) ? tc.card.rank : b, null);

  // Något ligger på bordet: 1) lägg på stege, 2) lägg trumf/slå trumf, 3) plocka
  if (leadSuit !== null) {
    const leadLen = state.trickLeadLength || 1;

    if (leadLen === 1) {
      const leadSuitCards = hand.filter((c) => c.suit === leadSuit);
      const trumpCards = hand.filter((c) => c.suit === trumpSuit);

      let playIndex = -1;

      // 1) Samma färg som slår
      if (leadSuitCards.length > 0) {
        const canBeat = toBeat
          ? leadSuitCards.filter((c) => RANK_VALUE[c.rank] > RANK_VALUE[toBeat])
          : leadSuitCards;
        if (canBeat.length > 0) {
          const lowest = canBeat.reduce((a, b) => (RANK_VALUE[a.rank] < RANK_VALUE[b.rank] ? a : b));
          playIndex = hand.indexOf(lowest);
        }
      }

      // 2) Kan inte: trumf
      if (playIndex < 0 && trumpCards.length > 0) {
        const canBeatTrump = highestTrump
          ? trumpCards.filter((c) => RANK_VALUE[c.rank] > RANK_VALUE[highestTrump])
          : trumpCards;
        if (canBeatTrump.length > 0) {
          const lowestTrump = canBeatTrump.reduce((a, b) => (RANK_VALUE[a.rank] < RANK_VALUE[b.rank] ? a : b));
          playIndex = hand.indexOf(lowestTrump);
        } else if (!highestTrump) {
          const lowestTrump = trumpCards.reduce((a, b) => (RANK_VALUE[a.rank] < RANK_VALUE[b.rank] ? a : b));
          playIndex = hand.indexOf(lowestTrump);
        }
      }

      if (playIndex >= 0) {
        return { kind: "trickCard", aiId, card: hand[playIndex], handIndex: playIndex };
      }
    } else {
      // Stege på bordet: försök lägga samma längd som slår (färg eller trumf)
      for (let len = leadLen; len >= 1; len--) {
        let bestPlay: { slice: Card[]; indices: number[] } | null = null;
        for (let start = 0; start <= hand.length - len; start++) {
          const slice = hand.slice(start, start + len);
          if (!isValidStege(slice)) continue;
          if (!isMultiLegalToPlay(state, slice)) continue;
          const indices = slice.map((c) => hand.indexOf(c));

          if (!bestPlay) bestPlay = { slice, indices };
          else {
            const myHigh = highestRank(slice);
            const bestHigh = highestRank(bestPlay.slice);
            if (RANK_VALUE[myHigh] < RANK_VALUE[bestHigh]) bestPlay = { slice, indices };
          }
        }
        if (bestPlay) return { kind: "trickCards", aiId, cards: bestPlay.slice, handIndices: bestPlay.indices };
      }
    }

    return { kind: "pickupTrick", aiId };
  }

  // Ledaren (ingen leadSuit än): hitta en “best lead” stege.
  const bestLead = findBestLead(hand);
  return { kind: "trickCards", aiId, cards: bestLead.cards, handIndices: bestLead.indices };
}

