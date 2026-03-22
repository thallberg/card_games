"use client";

import { useState, useCallback, useEffect } from "react";
import type { PlayerId, Rank } from "../types";
import { RANK_VALUE } from "../types";
import {
  highestRank,
  isMultiLegalToPlay,
  isValidStege,
} from "../skitgubbe-trick-logic";
import type { GameState } from "../game-state";
import { getPlayerIds } from "../game-state";
import {
  applyTrickCards,
  applyPickUpTrick,
  applyPlayCard,
  resolveStickWinner,
  resolveTrickWinner,
  continueToPlayState,
  getSkitgubbePreviewData,
} from "./useSkitgubbeGame";
import { fetchSkitgubbeState, sendSkitgubbeAction, fetchGameSession } from "../api/skitgubbeApi";
import type { SessionPlayer } from "../api/skitgubbeApi";
import { useGameSessionPoll } from "@/hooks/useGameSessionPoll";
import { getCurrentUserIdFromLocalStorage, isWaitingForStartForUser } from "@/lib/game-session";
import { sendAndSync } from "@/lib/multiplayer-sync";

export function useSkitgubbeGameMultiplayer(sessionId: string | undefined) {
  const [state, setState] = useState<GameState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<PlayerId>("p1");
  const [sessionPlayers, setSessionPlayers] = useState<SessionPlayer[] | null>(null);
  const [selectedTrickIndices, setSelectedTrickIndices] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(!!sessionId);
  const [waitingForStart, setWaitingForStart] = useState(false);

  const loadState = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await fetchSkitgubbeState(sessionId);
      if (data) {
        setState(data.state);
        setMyPlayerId(data.myPlayerId as PlayerId);
        setWaitingForStart(false);
        fetchGameSession(sessionId).then((session) => {
          if (session?.players?.length) setSessionPlayers(session.players);
        }).catch(() => { /* ignore */ });
      } else {
        const session = await fetchGameSession(sessionId).catch(() => null);
        const currentUserId = getCurrentUserIdFromLocalStorage();
        setWaitingForStart(isWaitingForStartForUser(session, currentUserId));
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      setLoading(true);
      setWaitingForStart(false);
    }
  }, [sessionId]);

  useGameSessionPoll({
    sessionId,
    loadState,
    isWaitingForStart: waitingForStart,
    waitForStartPollMs: 2000,
    shouldPausePolling:
      !state ||
      state.phase === "gameOver" ||
      state.phase === "setup" ||
      (state.currentPlayerId === myPlayerId &&
        !state.stickShowingWinner &&
        !state.trickShowingWinner),
    pollIntervalMs: 1500,
  });

  const sendState = useCallback(
    async (newState: GameState) => {
      await sendAndSync(
        sessionId,
        () => sendSkitgubbeAction(sessionId as string, newState),
        (data) => {
          setState(data.state);
          setMyPlayerId(data.myPlayerId as PlayerId);
        }
      );
    },
    [sessionId]
  );

  useEffect(() => {
    if (!state || !sessionId || state.phase !== "sticks" || state.stickShowingWinner !== myPlayerId) return;
    const t = setTimeout(() => {
      const next = resolveStickWinner(state);
      sendState(next);
    }, 1500);
    return () => clearTimeout(t);
  }, [state?.stickShowingWinner, state?.phase, myPlayerId, sessionId, state, sendState]);

  useEffect(() => {
    if (!state || !sessionId || state.phase !== "play" || state.trickShowingWinner !== myPlayerId) return;
    const t = setTimeout(() => {
      const next = resolveTrickWinner(state);
      sendState(next);
    }, 1500);
    return () => clearTimeout(t);
  }, [state?.trickShowingWinner, state?.phase, myPlayerId, sessionId, state, sendState]);

  useEffect(() => {
    if (!state || !sessionId || state.phase !== "play" || state.trickPickUpBy !== myPlayerId) return;
    const t = setTimeout(() => {
      sendState({ ...state, trickPickUpBy: null });
    }, 1500);
    return () => clearTimeout(t);
  }, [state?.phase, state?.trickPickUpBy, myPlayerId, sessionId, state, sendState]);

  const humanHand = state?.playerHands[myPlayerId] ?? [];
  const isHumanTurn = state?.currentPlayerId === myPlayerId;

  useEffect(() => {
    if (state?.phase !== "play" || !isHumanTurn) {
      setSelectedTrickIndices(new Set());
    }
  }, [state?.phase, isHumanTurn]);

  const playCardFromHand = useCallback(
    (handIndex: number) => {
      if (!state || state.phase !== "sticks" || state.currentPlayerId !== myPlayerId || state.stickShowingWinner) return;
      const hand = state.playerHands[myPlayerId];
      if (handIndex < 0 || handIndex >= (hand?.length ?? 0)) return;
      const card = hand![handIndex];
      const next = applyPlayCard(state, myPlayerId, card, handIndex);
      sendState(next);
    },
    [state, myPlayerId, sendState]
  );

  const drawAndPlay = useCallback(() => {
    if (!state || state.phase !== "sticks" || state.currentPlayerId !== myPlayerId || state.stickShowingWinner || state.stock.length === 0) return;
    const card = state.stock[state.stock.length - 1];
    const newStock = state.stock.slice(0, -1);
    const next = applyPlayCard(state, myPlayerId, card, -1, newStock);
    sendState(next);
  }, [state, myPlayerId, sendState]);

  const continueToPlay = useCallback(() => {
    if (!state || state.phase !== "skitgubbe") return;
    const next = continueToPlayState(state);
    sendState(next);
  }, [state, sendState]);

  const toggleTrickSelection = useCallback((handIndex: number) => {
    setSelectedTrickIndices((prev) => {
      const next = new Set(prev);
      if (next.has(handIndex)) next.delete(handIndex);
      else next.add(handIndex);
      return next;
    });
  }, []);

  const confirmTrickPlay = useCallback(() => {
    if (!state || state.phase !== "play" || state.currentPlayerId !== myPlayerId || state.trickShowingWinner) return;
    const hand = state.playerHands[myPlayerId] ?? [];
    const indices = [...selectedTrickIndices].sort((a, b) => a - b);
    const cards = indices.map((i) => hand[i]).filter(Boolean);
    if (indices.length === 0 || cards.length !== indices.length) return;
    const next = applyTrickCards(state, myPlayerId, cards, indices);
    sendState(next);
    setSelectedTrickIndices(new Set());
  }, [state, myPlayerId, selectedTrickIndices, sendState]);

  const pickUpTrick = useCallback(() => {
    if (!state || state.phase !== "play" || state.currentPlayerId !== myPlayerId || state.trickShowingWinner) return;
    const next = applyPickUpTrick(state, myPlayerId);
    sendState(next);
  }, [state, myPlayerId, sendState]);

  const playTrickCard = useCallback(
    (handIndex: number) => {
      if (state?.phase === "play" && isHumanTurn) toggleTrickSelection(handIndex);
    },
    [state?.phase, isHumanTurn, toggleTrickSelection]
  );

  const playerCount = state?.numPlayers ?? null;
  /** Samma logik som useSkitgubbeGame (single player) – annars blir inga handkort klickbara i stick-fasen. */
  const playableStickIndices = (() => {
    if (!state || state.phase !== "sticks" || !isHumanTurn || state.stickShowingWinner) return new Set<number>();
    const hand = state.playerHands[myPlayerId] ?? [];
    if (hand.length === 0) return new Set<number>();
    if (state.stickLedRank !== null) {
      if (state.playersMustPlay.includes(myPlayerId)) {
        return new Set(hand.map((c, i) => (c.rank === state.stickLedRank ? i : -1)).filter((i) => i >= 0));
      }
      if (state.stickFighters.includes(myPlayerId) && state.tableStick.some((sc) => sc.playerId === myPlayerId)) {
        return new Set(hand.map((_, i) => i));
      }
    }
    return new Set(hand.map((_, i) => i));
  })();

  const playableTrickIndices = (() => {
    if (!state || state.phase !== "play" || !isHumanTurn) return new Set<number>();
    const hand = state.playerHands[myPlayerId] ?? [];
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
          for (let j = 0; j < slice.length; j++) indices.add(start + j);
        } else if (inLeadSuit && toBeat && RANK_VALUE[myHigh] > RANK_VALUE[toBeat]) {
          for (let j = 0; j < slice.length; j++) indices.add(start + j);
        }
      }
    }
    return indices;
  })();

  const isTrickSelectionValid = (() => {
    if (!state || state.phase !== "play" || !isHumanTurn || state.trickShowingWinner || selectedTrickIndices.size === 0) return false;
    const hand = state.playerHands[myPlayerId] ?? [];
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

  const canPickUpTrick =
    state?.phase === "play" &&
    isHumanTurn &&
    !state?.trickShowingWinner &&
    (state?.tableTrick?.length ?? 0) > 0;

  const playerDisplayNames: Record<string, string> = {};
  const playerAvatarEmojis: Record<string, string | null> = {};
  if (state?.playerIds && sessionPlayers?.length) {
    const bySeat = [...sessionPlayers].sort((a, b) => a.seatOrder - b.seatOrder);
    state.playerIds.forEach((id, i) => {
      const p = bySeat[i];
      playerDisplayNames[id] = p?.displayName ?? "Spelare " + id;
      playerAvatarEmojis[id] = p?.avatarEmoji ?? null;
    });
  }

  return {
    state,
    loadState,
    playerCount,
    humanHand,
    isHumanTurn,
    playableStickIndices,
    playableTrickIndices,
    selectedTrickIndices,
    toggleTrickSelection,
    clearTrickSelection: () => setSelectedTrickIndices(new Set()),
    isTrickSelectionValid,
    confirmTrickPlay,
    canDrawAndPlay: state?.phase === "sticks" && isHumanTurn && !state?.stickShowingWinner && (state?.stock.length ?? 0) > 0,
    canPickUpTrick,
    startGame: () => {},
    playCardFromHand,
    drawAndPlay,
    continueToPlay,
    playTrickCard,
    pickUpTrick,
    resetGame: () => {},
    getPlayerIds: () => (state ? getPlayerIds(state) : []),
    getSkitgubbePreview: () => (state?.phase === "skitgubbe" ? getSkitgubbePreviewData(state) : null),
    playerDisplayNames,
    playerAvatarEmojis,
    loading,
    waitingForStart,
    myPlayerId,
  };
}
