"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
  getSkitgubbePlayerId,
} from "./useSkitgubbeGame";
import { fetchSkitgubbeState, sendSkitgubbeAction, fetchGameSession } from "../api/skitgubbeApi";

const POLL_INTERVAL_MS = 1500;
const WAITING_POLL_MS = 2000;

export function useSkitgubbeGameMultiplayer(sessionId: string | undefined) {
  const [state, setState] = useState<GameState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<PlayerId>("p1");
  const [selectedTrickIndices, setSelectedTrickIndices] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(!!sessionId);
  const [waitingForStart, setWaitingForStart] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadState = useCallback(async () => {
    if (!sessionId) return;
    const data = await fetchSkitgubbeState(sessionId);
    if (data) {
      setState(data.state);
      setMyPlayerId(data.myPlayerId as PlayerId);
      setWaitingForStart(false);
    } else {
      const session = await fetchGameSession(sessionId);
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
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    setWaitingForStart(false);
    loadState();
  }, [sessionId, loadState]);

  useEffect(() => {
    if (!sessionId || !waitingForStart) return;
    const interval = setInterval(loadState, WAITING_POLL_MS);
    return () => clearInterval(interval);
  }, [sessionId, waitingForStart, loadState]);

  useEffect(() => {
    if (!sessionId || !state) return;
    if (state.phase === "gameOver" || state.phase === "setup") return;
    const isMyTurn = state.currentPlayerId === myPlayerId;
    if (isMyTurn && !state.stickShowingWinner && !state.trickShowingWinner) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    loadState();
    pollRef.current = setInterval(loadState, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessionId, state?.currentPlayerId, state?.phase, state?.stickShowingWinner, state?.trickShowingWinner, myPlayerId, loadState, state]);

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
  const playableTrickIndices = (() => {
    if (!state || state.phase !== "play" || !isHumanTurn) return new Set<number>();
    const hand = state.playerHands[myPlayerId] ?? [];
    if (hand.length === 0) return new Set<number>();
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
    (state?.tableTrick?.length ?? 0) > 0;

  return {
    state,
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
    getSkitgubbePreview: () => (state?.phase === "skitgubbe" ? getSkitgubbePlayerId(state) : null),
    loading,
    waitingForStart,
    myPlayerId,
  };
}
