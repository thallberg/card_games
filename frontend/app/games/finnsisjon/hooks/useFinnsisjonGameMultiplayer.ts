"use client";

import { useState, useCallback, useEffect } from "react";
import type { PlayerId, Rank } from "../types";
import type { GameState } from "../game-state";
import { getPlayerIds, applyAsk, applyDrawCardFromSjön } from "../game-state";
import { fetchFinnsisjonState, sendFinnsisjonAction, fetchGameSession } from "../api/finnsisjonApi";
import type { SessionPlayer } from "../api/finnsisjonApi";
import { useGameSessionPoll } from "@/hooks/useGameSessionPoll";
import { getCurrentUserIdFromLocalStorage, isWaitingForStartForUser } from "@/lib/game-session";
import { sendAndSync } from "@/lib/multiplayer-sync";

function getRanksInHand(hand: { rank: string }[]): Rank[] {
  return [...new Set(hand.map((c) => c.rank))] as Rank[];
}

export function useFinnsisjonGameMultiplayer(sessionId: string | undefined) {
  const [state, setState] = useState<GameState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<PlayerId>("p1");
  const [sessionPlayers, setSessionPlayers] = useState<SessionPlayer[] | null>(null);
  const [loading, setLoading] = useState(!!sessionId);
  const [waitingForStart, setWaitingForStart] = useState(false);

  const loadState = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await fetchFinnsisjonState(sessionId);
      if (data) {
        setState(data.state);
        setMyPlayerId(data.myPlayerId as PlayerId);
        setWaitingForStart(false);
        fetchGameSession(sessionId).then((session) => {
          if (session?.players?.length) setSessionPlayers(session.players);
        }).catch(() => {});
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
      (state.currentPlayerId === myPlayerId && !state.lastWasFinnsISjon),
    pollIntervalMs: 1500,
  });

  const sendState = useCallback(
    async (newState: GameState) => {
      await sendAndSync(
        sessionId,
        () => sendFinnsisjonAction(sessionId as string, newState),
        (data) => {
          setState(data.state);
          setMyPlayerId(data.myPlayerId as PlayerId);
        }
      );
    },
    [sessionId]
  );

  const humanHand = state?.playerHands[myPlayerId] ?? [];
  const isHumanTurn = state?.phase === "play" && state?.currentPlayerId === myPlayerId;
  const ranksIHave = getRanksInHand(humanHand);
  const canAsk = isHumanTurn && !state?.lastWasFinnsISjon && ranksIHave.length > 0;
  const mustDrawFromSjön = isHumanTurn && state?.lastWasFinnsISjon === true;

  const askForRank = useCallback(
    (to: PlayerId, rank: Rank) => {
      if (!state || state.phase !== "play" || state.currentPlayerId !== myPlayerId) return;
      const next = applyAsk(state, myPlayerId, to, rank);
      sendState(next);
    },
    [state, myPlayerId, sendState]
  );

  const drawCardFromSjön = useCallback(
    (cardIndex: number) => {
      if (!state || state.phase !== "play" || !state.lastWasFinnsISjon || state.currentPlayerId !== myPlayerId) return;
      const next = applyDrawCardFromSjön(state, myPlayerId, cardIndex);
      sendState(next);
    },
    [state, myPlayerId, sendState]
  );

  const playerDisplayNames: Record<string, string> = {};
  const playerAvatarEmojis: Record<string, string | null> = {};
  if (state?.playerIds?.length && sessionPlayers?.length) {
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
    humanHand,
    isHumanTurn,
    canAsk,
    mustDrawFromSjön,
    askForRank,
    drawCardFromSjön,
    getPlayerIds: () => (state ? getPlayerIds(state) : []),
    playerDisplayNames,
    playerAvatarEmojis,
    loading,
    waitingForStart,
    myPlayerId,
    pendingAskFromAI: null,
    pendingAiDrawStep: 0 as 0 | 1 | 2,
    lastAiAskWasFinnsISjon: false,
    playerCount: state?.playerIds?.length ?? null,
    startGame: () => {},
    resetGame: () => {},
  };
}
