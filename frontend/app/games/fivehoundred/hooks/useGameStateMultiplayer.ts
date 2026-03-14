"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type { Card } from "../types";
import type { GameState } from "../game-state";
import { sortHand } from "../deck";
import { fetchFiveHundredState, fetchGameSession, sendFiveHundredAction, startFiveHundredNewRound, resetFiveHundredGame } from "../api/fiveHundredApi";
import type { SessionPlayer } from "../api/fiveHundredApi";
import { useGameSessionPoll } from "@/hooks/useGameSessionPoll";

export function useGameStateMultiplayer(sessionId: string | undefined) {
  const [state, setState] = useState<GameState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string>("p1");
  const [sessionPlayers, setSessionPlayers] = useState<SessionPlayer[] | null>(null);
  const [lastDrawnCard, setLastDrawnCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(!!sessionId);
  const [waitingForStart, setWaitingForStart] = useState(false);

  const loadState = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await fetchFiveHundredState(sessionId);
      if (data) {
        setState(data.state);
        setMyPlayerId(data.myPlayerId);
        setLastDrawnCard(null);
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
          } catch { /* ignore */ }
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
      state != null &&
      state.phase !== "gameOver" &&
      state.currentPlayerId === myPlayerId &&
      state.phase !== "roundEnd",
    isGameOver: state?.phase === "gameOver",
    gameOverPollMs: 3000,
    pollIntervalMs: 1000,
  });

  const runAction = useCallback(
    async (
      action: string,
      payload?: {
        cardIndex?: number;
        cardIndices?: number[];
        meldId?: string;
        wildRepresents?: Record<number, Card>;
        wildAs?: Card;
      }
    ) => {
      if (!sessionId) return;
      const result = await sendFiveHundredAction(sessionId, action, payload);
      if (result) {
        setState(result.state);
        setLastDrawnCard(result.lastDrawnCard ?? null);
      }
    },
    [sessionId]
  );

  const drawFromStock = useCallback(() => runAction("drawFromStock"), [runAction]);
  const takeDiscardPile = useCallback(() => runAction("takeDiscard"), [runAction]);
  const skipDraw = useCallback(() => runAction("skipDraw"), [runAction]);
  const discardCard = useCallback((handIndex: number) => runAction("discard", { cardIndex: handIndex }), [runAction]);
  const passWithoutDiscard = useCallback(() => runAction("pass"), [runAction]);
  const addMeld = useCallback(
    (cardIndices: number[], wildRepresents?: Record<number, Card>) =>
      runAction("addMeld", { cardIndices, wildRepresents }),
    [runAction]
  );
  const addCardToExistingMeld = useCallback(
    (meldId: string, handIndex: number, wildAs?: Card) =>
      runAction("addCardToMeld", { meldId, cardIndex: handIndex, wildAs }),
    [runAction]
  );
  const advanceToNextTurn = useCallback(() => {}, []);

  const resetGame = useCallback(async () => {
    if (!sessionId) return;
    const data = await resetFiveHundredGame(sessionId);
    if (data) {
      setState(data.state);
      setMyPlayerId(data.myPlayerId);
      setLastDrawnCard(null);
    }
  }, [sessionId]);

  const startNewRound = useCallback(async () => {
    if (!sessionId) return;
    const data = await startFiveHundredNewRound(sessionId);
    if (data) {
      setState(data.state);
      setMyPlayerId(data.myPlayerId);
      setLastDrawnCard(null);
    }
  }, [sessionId]);

  const getPlayerIds = useCallback(() => (state ? Object.keys(state.playerHands) as import("../types").PlayerId[] : ["p1", "p2"]), [state]);

  const playerDisplayNames: Record<string, string> = useMemo(() => {
    const ids = state ? Object.keys(state.playerHands) : [];
    if (!sessionPlayers?.length || ids.length === 0) return {};
    const bySeat = [...sessionPlayers].sort((a, b) => a.seatOrder - b.seatOrder);
    const out: Record<string, string> = {};
    ids.forEach((id, i) => {
      out[id] = bySeat[i]?.displayName ?? "Spelare " + id;
    });
    return out;
  }, [state?.playerHands, sessionPlayers]);

  const playerAvatarEmojis: Record<string, string | null> = useMemo(() => {
    const ids = state ? Object.keys(state.playerHands) : [];
    if (!sessionPlayers?.length || ids.length === 0) return {};
    const bySeat = [...sessionPlayers].sort((a, b) => a.seatOrder - b.seatOrder);
    const out: Record<string, string | null> = {};
    ids.forEach((id, i) => {
      out[id] = bySeat[i]?.avatarEmoji ?? null;
    });
    return out;
  }, [state?.playerHands, sessionPlayers]);

  const humanHand = useMemo(
    () => sortHand(state?.playerHands[myPlayerId] ?? []),
    [state, myPlayerId]
  );
  const topDiscard = state && state.discard.length > 0 ? state.discard[0] : null;

  return {
    state,
    loading,
    waitingForStart,
    loadState,
    isReady: state != null && !loading,
    humanHand,
    topDiscard,
    isHumanTurn: state != null && state.phase !== "roundEnd" && state.phase !== "gameOver" && state.currentPlayerId === myPlayerId,
    canDraw: state != null && state.phase === "draw" && state.currentPlayerId === myPlayerId,
    canDrawFromStock: state != null && state.phase === "draw" && state.currentPlayerId === myPlayerId && (state.stock?.length ?? 0) > 0,
    canTakeDiscard: state != null && state.phase === "draw" && state.currentPlayerId === myPlayerId && (state.discard?.length ?? 0) > 0,
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
    playerDisplayNames,
    playerAvatarEmojis,
    myPlayerId,
    lastDrawnCard,
    lastDrawnCards: lastDrawnCard != null ? [lastDrawnCard] : [],
    hasLaidFirstMeld: (state?.melds?.some((m) => m.ownerId === myPlayerId)) ?? false,
  };
}
