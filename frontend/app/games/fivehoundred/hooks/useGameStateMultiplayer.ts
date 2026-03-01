"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { GameState } from "../game-state";
import { getPlayerIds as getPlayerIdsSingle, getNextPlayerId } from "../game-state";
import { fetchFiveHundredState, sendFiveHundredAction, startFiveHundredNewRound } from "../api/fiveHundredApi";

const POLL_INTERVAL_MS = 2000;

export function useGameStateMultiplayer(sessionId: string | undefined) {
  const [state, setState] = useState<GameState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string>("p1");
  const [loading, setLoading] = useState(!!sessionId);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadState = useCallback(async () => {
    if (!sessionId) return;
    const data = await fetchFiveHundredState(sessionId);
    if (data) {
      setState(data.state);
      setMyPlayerId(data.myPlayerId);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    loadState();
  }, [sessionId, loadState]);

  useEffect(() => {
    if (!sessionId || !state) return;
    const isMyTurn = state.currentPlayerId === myPlayerId;
    if (isMyTurn) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = setInterval(loadState, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessionId, state?.currentPlayerId, myPlayerId, loadState, state]);

  const runAction = useCallback(
    async (action: string, payload?: { cardIndex?: number; cardIndices?: number[]; meldId?: string }) => {
      if (!sessionId) return;
      const newState = await sendFiveHundredAction(sessionId, action, payload);
      if (newState) setState(newState);
    },
    [sessionId]
  );

  const drawFromStock = useCallback(() => runAction("drawFromStock"), [runAction]);
  const takeDiscardPile = useCallback(() => runAction("takeDiscard"), [runAction]);
  const skipDraw = useCallback(() => runAction("skipDraw"), [runAction]);
  const discardCard = useCallback((handIndex: number) => runAction("discard", { cardIndex: handIndex }), [runAction]);
  const passWithoutDiscard = useCallback(() => runAction("pass"), [runAction]);
  const addMeld = useCallback((cardIndices: number[]) => runAction("addMeld", { cardIndices }), [runAction]);
  const addCardToExistingMeld = useCallback(
    (meldId: string, handIndex: number) => runAction("addCardToMeld", { meldId, cardIndex: handIndex }),
    [runAction]
  );
  const advanceToNextTurn = useCallback(() => {}, []);
  const resetGame = useCallback(() => {}, []);

  const startNewRound = useCallback(async () => {
    if (!sessionId) return;
    const data = await startFiveHundredNewRound(sessionId);
    if (data) {
      setState(data.state);
      setMyPlayerId(data.myPlayerId);
    }
  }, [sessionId]);

  const getPlayerIds = useCallback(() => (state ? Object.keys(state.playerHands) as import("../types").PlayerId[] : ["p1", "p2"]), [state]);

  const humanHand = state?.playerHands[myPlayerId] ?? [];
  const topDiscard = state && state.discard.length > 0 ? state.discard[0] : null;

  return {
    state,
    isReady: state != null && !loading,
    humanHand,
    topDiscard,
    isHumanTurn: state != null && state.phase !== "roundEnd" && state.phase !== "gameOver" && state.currentPlayerId === myPlayerId,
    canDraw: state != null && state.phase === "draw" && state.currentPlayerId === myPlayerId && (state.stock?.length ?? 0) > 0,
    stockEmpty: state != null && (state.stock?.length ?? 0) === 0,
    drawFromStock,
    takeDiscardPile,
    skipDraw,
    discardCard,
    passWithoutDiscard,
    addMeld,
    addCardToExistingMeld,
    advanceToNextTurn,
    resetGame,
    startNewRound,
    getPlayerIds,
    myPlayerId,
    lastDrawnCard: null,
  };
}
