"use client";

import { useState, useCallback, useEffect } from "react";
import type { PlayerId, Rank } from "../types";
import type { GameState } from "../game-state";
import {
  createInitialState,
  getPlayerIds,
} from "../game-state";
import { RANK_VALUE } from "../types";
import { useDelayedSingleFlight } from "@/hooks/useDelayedSingleFlight";
import { getAiStickMove, getAiTrickMove } from "../skitgubbe-ai";
import {
  highestRank,
  isMultiLegalToPlay,
  isValidStege,
} from "../skitgubbe-trick-logic";
import {
  applyPickUpTrick,
  applyPlayCard,
  applyTrickCard,
  applyTrickCards,
  resolveStickWinner,
  resolveTrickWinner,
} from "../skitgubbe-engine";
import {
  continueToPlayState,
  getSkitgubbePreviewData,
} from "../skitgubbe-phase";

const HUMAN_PLAYER: PlayerId = "p1";

// trick-regler (validering + rangordning) är flyttade till shared trick-logic.

export function useSkitgubbeGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [selectedTrickIndices, setSelectedTrickIndices] = useState<Set<number>>(new Set());
  const humanHand = state?.playerHands[HUMAN_PLAYER] ?? [];
  const isHumanTurn = state?.currentPlayerId === HUMAN_PLAYER;

  const playableStickIndices = (() => {
    if (!state || state.phase !== "sticks" || !isHumanTurn || state.stickShowingWinner) return new Set<number>();
    const hand = state.playerHands[HUMAN_PLAYER] ?? [];
    if (hand.length === 0) return new Set<number>();
    if (state.stickLedRank !== null) {
      if (state.playersMustPlay.includes(HUMAN_PLAYER)) {
        return new Set(hand.map((c, i) => (c.rank === state.stickLedRank ? i : -1)).filter((i) => i >= 0));
      }
      if (state.stickFighters.includes(HUMAN_PLAYER) && state.tableStick.some((sc) => sc.playerId === HUMAN_PLAYER)) {
        return new Set(hand.map((_, i) => i));
      }
    }
    return new Set(hand.map((_, i) => i));
  })();

  const playableTrickIndices = (() => {
    if (!state || state.phase !== "play" || !isHumanTurn) return new Set<number>();
    const hand = state.playerHands[HUMAN_PLAYER] ?? [];
    if (hand.length === 0) return new Set<number>();
    const tableTrick = state.tableTrick ?? [];
    const isLeading = tableTrick.length === 0 || state.trickLeadSuit === null;
    if (isLeading) return new Set(hand.map((_, i) => i));

    const leadLen = state.trickLeadLength || 1;
    const toBeat = state.trickHighRank ?? null;
    const leadSuit = state.trickLeadSuit;
    const trumpSuit = state.trumpSuit;

    const highestTrumpOnTable = tableTrick
      .filter((tc) => tc.card.suit === trumpSuit)
      .reduce<Rank | null>((best, tc) => {
        if (!best) return tc.card.rank;
        return RANK_VALUE[tc.card.rank] > RANK_VALUE[best] ? tc.card.rank : best;
      }, null);

    const indices = new Set<number>();
    for (let len = 1; len <= leadLen; len++) {
      for (let start = 0; start <= hand.length - len; start++) {
        const slice = hand.slice(start, start + len);
        if (!isValidStege(slice)) continue;
        const myHigh = highestRank(slice);
        const inLeadSuit = slice.every((c) => c.suit === leadSuit);
        const inTrump = slice.every((c) => c.suit === trumpSuit);
        if (inTrump && (!highestTrumpOnTable || RANK_VALUE[myHigh] > RANK_VALUE[highestTrumpOnTable])) {
          slice.forEach((c) => indices.add(hand.indexOf(c)));
        } else if (inLeadSuit && toBeat && RANK_VALUE[myHigh] > RANK_VALUE[toBeat]) {
          slice.forEach((c) => indices.add(hand.indexOf(c)));
        }
      }
    }
    return indices;
  })();

  const canPickUpTrick =
    state?.phase === "play" &&
    isHumanTurn &&
    !state?.trickShowingWinner &&
    (state?.tableTrick?.length ?? 0) > 0;

  const toggleTrickSelection = useCallback((handIndex: number) => {
    setSelectedTrickIndices((prev) => {
      const next = new Set(prev);
      if (next.has(handIndex)) next.delete(handIndex);
      else next.add(handIndex);
      return next;
    });
  }, []);

  const clearTrickSelection = useCallback(() => {
    setSelectedTrickIndices(new Set());
  }, []);

  const isTrickSelectionValid = (() => {
    if (!state || state.phase !== "play" || !isHumanTurn || state.trickShowingWinner || selectedTrickIndices.size === 0)
      return false;
    const hand = state.playerHands[HUMAN_PLAYER] ?? [];
    const cards = [...selectedTrickIndices].sort((a, b) => a - b).map((i) => hand[i]).filter(Boolean);
    if (cards.length !== selectedTrickIndices.size) return false;
    const tableTrick = state.tableTrick ?? [];
    const isLeading = tableTrick.length === 0 || state.trickLeadSuit === null;
    if (isLeading) return isValidStege(cards);
    const leadLen = state.trickLeadLength || 1;
    if (cards.length < 1 || cards.length > leadLen) return false;
    if (!isValidStege(cards)) return false;
    return isMultiLegalToPlay(state, cards);
  })();

  const confirmTrickPlay = useCallback(() => {
    if (!isTrickSelectionValid) return;
    setState((s) => {
      if (!s || s.phase !== "play" || s.currentPlayerId !== HUMAN_PLAYER) return s;
      const hand = s.playerHands[HUMAN_PLAYER];
      const indices = [...selectedTrickIndices].sort((a, b) => a - b);
      const cards = indices.map((i) => hand[i]);
      return applyTrickCards(s, HUMAN_PLAYER, cards, indices);
    });
    setSelectedTrickIndices(new Set());
  }, [isTrickSelectionValid, selectedTrickIndices]);

  const startGame = useCallback((count: number) => {
    setPlayerCount(count);
    setState(createInitialState(count));
  }, []);

  const playCardFromHand = useCallback((handIndex: number) => {
    setState((s) => {
      if (!s || s.phase !== "sticks" || s.currentPlayerId !== HUMAN_PLAYER || s.stickShowingWinner) return s;
      const hand = s.playerHands[HUMAN_PLAYER];
      if (handIndex < 0 || handIndex >= hand.length) return s;
      const card = hand[handIndex];
      if (s.stickLedRank !== null && s.playersMustPlay.includes(HUMAN_PLAYER) && card.rank !== s.stickLedRank)
        return s;
      return applyPlayCard(s, HUMAN_PLAYER, card, handIndex);
    });
  }, []);

  const drawAndPlay = useCallback(() => {
    setState((s) => {
      if (!s || s.phase !== "sticks" || s.currentPlayerId !== HUMAN_PLAYER || s.stickShowingWinner) return s;
      if (s.stock.length === 0) return s;
      const card = s.stock[s.stock.length - 1];
      const newStock = s.stock.slice(0, -1);
      return applyPlayCard(s, HUMAN_PLAYER, card, -1, newStock);
    });
  }, []);

  const continueToPlay = useCallback(() => {
    setState((s) => (s ? continueToPlayState(s) : s));
  }, []);

  const pickUpTrick = useCallback(() => {
    setState((s) => {
      if (!s || s.phase !== "play" || s.currentPlayerId !== HUMAN_PLAYER) return s;
      return applyPickUpTrick(s, HUMAN_PLAYER);
    });
  }, []);

  const playTrickCard = useCallback(
    (handIndex: number) => {
      if (state?.phase === "play" && isHumanTurn) {
        toggleTrickSelection(handIndex);
      }
    },
    [state?.phase, isHumanTurn, toggleTrickSelection]
  );

  const resetGame = useCallback(() => {
    setPlayerCount(null);
    setState(null);
  }, []);

  useEffect(() => {
    if (!state || state.phase !== "sticks" || !state.stickShowingWinner) return;
    const t = setTimeout(() => {
      setState((s) => (s ? resolveStickWinner(s) : s));
    }, 1500);
    return () => clearTimeout(t);
  }, [state?.stickShowingWinner]);

  useDelayedSingleFlight({
    enabled: !!state && state.phase === "sticks" && !state.stickShowingWinner && state.currentPlayerId !== HUMAN_PLAYER,
    delayMs: 700,
    onFire: () => {
      setState((s) => {
        if (!s || s.phase !== "sticks" || s.currentPlayerId === HUMAN_PLAYER) return s;
        const move = getAiStickMove(s, HUMAN_PLAYER);
        if (!move) return s;
        if (move.kind === "stock") {
          return applyPlayCard(s, move.aiId, move.card, move.handIndex, move.newStock);
        }
        return applyPlayCard(s, move.aiId, move.card, move.handIndex);
      });
    },
  });

  useEffect(() => {
    if (!state || state.phase !== "play" || !state.trickShowingWinner) return;
    const t = setTimeout(() => {
      setState((s) => (s ? resolveTrickWinner(s) : s));
    }, 1500);
    return () => clearTimeout(t);
  }, [state?.phase, state?.trickShowingWinner]);

  useEffect(() => {
    if (!state || state.phase !== "play" || !state.trickPickUpBy) return;
    const t = setTimeout(() => {
      setState((s) => {
        if (!s || s.phase !== "play" || !s.trickPickUpBy) return s;
        return { ...s, trickPickUpBy: null };
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [state?.phase, state?.trickPickUpBy]);

  useDelayedSingleFlight({
    enabled: !!state && state.phase === "play" && !state.trickShowingWinner && state.currentPlayerId !== HUMAN_PLAYER,
    delayMs: 2000,
    onFire: () => {
      setState((s) => {
        if (!s || s.phase !== "play" || s.currentPlayerId === HUMAN_PLAYER) return s;
        const move = getAiTrickMove(s, HUMAN_PLAYER);
        if (!move) return s;
        if (move.kind === "trickCard") {
          return applyTrickCard(s, move.aiId, move.card, move.handIndex);
        }
        if (move.kind === "trickCards") {
          return applyTrickCards(s, move.aiId, move.cards, move.handIndices);
        }
        return applyPickUpTrick(s, move.aiId);
      });
    },
  });

  useEffect(() => {
    if (state?.phase !== "play" || !isHumanTurn) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedTrickIndices(new Set());
    }
  }, [state?.phase, isHumanTurn]);

  return {
    state,
    playerCount,
    humanHand,
    isHumanTurn,
    playableStickIndices,
    playableTrickIndices,
    selectedTrickIndices,
    toggleTrickSelection,
    clearTrickSelection,
    isTrickSelectionValid,
    confirmTrickPlay,
    canDrawAndPlay: state?.phase === "sticks" && isHumanTurn && !state?.stickShowingWinner && (state?.stock.length ?? 0) > 0,
    canPickUpTrick,
    startGame,
    playCardFromHand,
    drawAndPlay,
    continueToPlay,
    playTrickCard,
    pickUpTrick,
    resetGame,
    getPlayerIds: () => (state ? getPlayerIds(state) : []),
    getSkitgubbePreview: () =>
      state?.phase === "skitgubbe" ? getSkitgubbePreviewData(state) : null,
  };
}

export {
  getSkitgubbePreviewData,
  getSkitgubbePlayerId,
  continueToPlayState,
} from "../skitgubbe-phase";
export {
  applyTrickCards,
  applyPickUpTrick,
  applyPlayCard,
  getNextInOrder,
  getDrawOrder,
  resolveStickWinner,
  resolveTrickWinner,
} from "../skitgubbe-engine";
