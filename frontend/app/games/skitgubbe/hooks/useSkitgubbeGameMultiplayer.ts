"use client";

import { useState, useCallback, useEffect } from "react";
import type { Card, PlayerId } from "../types";
import { RANK_VALUE } from "../types";
import type { GameState } from "../game-state";
import { getPlayerIds } from "../game-state";
import { sortHandForPlay } from "../deck";
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
        const raw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
        let currentUserId: string | null = null;
        if (raw) {
          try {
            const u = JSON.parse(raw) as { id?: string };
            currentUserId = u?.id ?? null;
          } catch {
            /* ignore */
          }
        }
        const isInSession = session?.players?.some(
          (p) => String(p.userId).toLowerCase() === String(currentUserId ?? "").toLowerCase()
        );
        if (session?.status === "Waiting" && isInSession) {
          setWaitingForStart(true);
        } else {
          setWaitingForStart(false);
        }
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
      if (!sessionId) return;
      const data = await sendSkitgubbeAction(sessionId, newState);
      if (data) {
        setState(data.state);
        setMyPlayerId(data.myPlayerId as PlayerId);
      }
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
      const inFight = (state?.trickFighters?.length ?? 0) > 0 && state?.trickFighters?.includes(myPlayerId);
      if (inFight) {
        if (next.has(handIndex)) next.delete(handIndex);
        else return new Set([handIndex]);
        return next;
      }
      if (next.has(handIndex)) next.delete(handIndex);
      else next.add(handIndex);
      return next;
    });
  }, [state, myPlayerId]);

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
  const playableStickIndices = (() => {
    if (!state || state.phase !== "sticks" || !isHumanTurn || state.stickShowingWinner) return new Set<number>();
    const hand = state.playerHands[myPlayerId] ?? [];
    if (state.stickLedRank === null) return new Set(hand.map((_, i) => i));
    if (!state.playersMustPlay.includes(myPlayerId)) return new Set<number>();
    const idx = hand.findIndex((c) => c.rank === state.stickLedRank);
    return idx >= 0 ? new Set([idx]) : new Set<number>();
  })();

  const tableTrick = state?.tableTrick ?? [];
  const tableTrickLen = tableTrick.length;
  const trickLeadSuit = state?.trickLeadSuit;
  const isLeading = tableTrickLen === 0 || !trickLeadSuit;
  const inTrickFight = (state?.trickFighters?.length ?? 0) > 0 && (state?.trickFighters?.includes(myPlayerId) ?? false);
  const playableTrickIndices = (() => {
    if (!state || state.phase !== "play" || !isHumanTurn) return new Set<number>();
    const hand = state.playerHands[myPlayerId] ?? [];
    if (hand.length === 0) return new Set<number>();
    if (inTrickFight) return new Set(hand.map((_, i) => i));
    if (isLeading) return new Set(hand.map((_, i) => i));
    const leadLen = state.trickLeadLength || 1;
    const toBeat = state.trickHighRank ?? null;
    const trumpSuit = state.trumpSuit;
    const indices = new Set<number>();
    for (let len = 1; len <= leadLen; len++) {
      for (let start = 0; start <= hand.length - len; start++) {
        const slice = hand.slice(start, start + len);
        const sorted = [...slice].sort((a, b) => RANK_VALUE[a.rank] - RANK_VALUE[b.rank]);
        let valid = sorted.every((c) => c.suit === sorted[0].suit);
        if (valid && len > 1) {
          for (let i = 1; i < sorted.length; i++) {
            if (RANK_VALUE[sorted[i].rank] !== RANK_VALUE[sorted[i - 1].rank] + 1) {
              valid = false;
              break;
            }
          }
        }
        if (!valid && len > 1) continue;
        const myHigh = slice.reduce((best, c) => (RANK_VALUE[c.rank] > RANK_VALUE[best] ? c.rank : best), slice[0].rank);
        const inLeadSuit = slice.every((c) => c.suit === trickLeadSuit);
        const inTrump = slice.every((c) => c.suit === trumpSuit);
        const highestTrumpOnTable = tableTrick
          .filter((tc) => tc.card.suit === trumpSuit)
          .reduce<typeof toBeat | null>((b, tc) => (!b || RANK_VALUE[tc.card.rank] > RANK_VALUE[b] ? tc.card.rank : b), null);
        if (inTrump && (!highestTrumpOnTable || RANK_VALUE[myHigh] > RANK_VALUE[highestTrumpOnTable])) slice.forEach((c) => indices.add(hand.indexOf(c)));
        else if (inLeadSuit && toBeat && RANK_VALUE[myHigh] > RANK_VALUE[toBeat]) slice.forEach((c) => indices.add(hand.indexOf(c)));
      }
    }
    return indices;
  })();

  const isTrickSelectionValid = (() => {
    if (!state || state.phase !== "play" || !isHumanTurn || state.trickShowingWinner || selectedTrickIndices.size === 0) return false;
    const hand = state.playerHands[myPlayerId] ?? [];
    const cards = [...selectedTrickIndices].sort((a, b) => a - b).map((i) => hand[i]).filter(Boolean);
    if (cards.length !== selectedTrickIndices.size) return false;
    if (inTrickFight) return selectedTrickIndices.size === 1;
    if (isLeading) {
      if (cards.length === 1) return true;
      const suit = cards[0].suit;
      if (!cards.every((c) => c.suit === suit)) return false;
      const sorted = [...cards].sort((a, b) => RANK_VALUE[a.rank] - RANK_VALUE[b.rank]);
      for (let i = 1; i < sorted.length; i++) if (RANK_VALUE[sorted[i].rank] !== RANK_VALUE[sorted[i - 1].rank] + 1) return false;
      return true;
    }
    const leadLen = state.trickLeadLength || 1;
    if (cards.length < 1 || cards.length > leadLen) return false;
    return true;
  })();

  const canPickUpTrick =
    state?.phase === "play" &&
    isHumanTurn &&
    !state?.trickShowingWinner &&
    (state?.trickFighters?.length ?? 0) === 0 &&
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
