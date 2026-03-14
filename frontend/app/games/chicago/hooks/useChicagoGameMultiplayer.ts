"use client";

import { useState, useCallback, useEffect } from "react";
import type { Card, PlayerId } from "../types";
import type { GameState } from "../game-state";
import { RANK_VALUE } from "../types";
import { getNextPlayerId, getTrickWinner } from "../game-state";
import { sortHand } from "../deck";
import { getHandPoints, getHandDescription } from "../hand-score";
import { fetchChicagoState, sendChicagoAction, startChicagoNewRound } from "../api/chicagoApi";
import { getPlayerIds } from "../game-state";
import { useGameSessionPoll } from "@/hooks/useGameSessionPoll";


export function useChicagoGameMultiplayer(sessionId: string | undefined) {
  const [state, setState] = useState<GameState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<PlayerId>("p1");
  const [selectedToDiscard, setSelectedToDiscard] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(!!sessionId);

  const loadState = useCallback(async () => {
    if (!sessionId) return;
    const data = await fetchChicagoState(sessionId);
    if (data) {
      setState(data.state);
      setMyPlayerId(data.myPlayerId as PlayerId);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) setLoading(true);
  }, [sessionId]);

  useGameSessionPoll({
    sessionId,
    loadState,
    shouldPausePolling:
      !state ||
      state.phase === "roundEnd" ||
      state.phase === "gameOver" ||
      !!state.drawPick ||
      state.currentPlayerId === myPlayerId,
    pollIntervalMs: 1500,
  });

  const humanHand = state?.playerHands[myPlayerId] ?? [];
  const playableCardIndices = (() => {
    if (!state || state.phase !== "play") return new Set<number>();
    const isLeader = state.trickCards === null;
    const active = isLeader ? state.trickLeader : getNextPlayerId(state.trickLeader, state);
    if (active !== myPlayerId) return new Set<number>();
    const hand = state.playerHands[myPlayerId];
    if (!hand?.length) return new Set<number>();
    if (isLeader) return new Set(hand.map((_, i) => i));
    const leadCard = state.trickCards![0];
    const sameSuitIndices = hand.map((c, i) => (c.suit === leadCard.suit ? i : -1)).filter((i) => i >= 0);
    if (sameSuitIndices.length > 0) return new Set(sameSuitIndices);
    return new Set(hand.map((_, i) => i));
  })();

  const canConfirmDiscard =
    state?.phase === "draw" &&
    state.currentPlayerId === myPlayerId &&
    !state?.drawPick &&
    selectedToDiscard.size >= 1 &&
    selectedToDiscard.size <= humanHand.length &&
    (selectedToDiscard.size === 1 ? (state?.deck.length ?? 0) >= 2 : (state?.deck.length ?? 0) >= selectedToDiscard.size);

  const canFreeSwapAllFive =
    state?.phase === "draw" &&
    state?.currentPlayerId === myPlayerId &&
    !state?.drawPick &&
    state?.drawRound === 0 &&
    (state?.freeSwapUsedCount ?? 0) < 3 &&
    humanHand.length === 5 &&
    humanHand.every((c) => RANK_VALUE[c.rank] <= 8);

  const applyAndSend = useCallback(
    async (nextState: GameState) => {
      if (!sessionId) return;
      const result = await sendChicagoAction(sessionId, JSON.stringify(nextState));
      if (result) {
        setState(result.state);
        setMyPlayerId(result.myPlayerId as PlayerId);
      }
    },
    [sessionId]
  );

  const confirmDiscard = useCallback(() => {
    if (!state || state.phase !== "draw" || state.currentPlayerId !== myPlayerId || state.drawPick || !sessionId) return;
    const hand = state.playerHands[myPlayerId];
    const indices = [...selectedToDiscard].filter((i) => i >= 0 && i < hand.length).sort((a, b) => b - a);
    const toDiscard = indices.length;
    if (toDiscard <= 0) return;
    const tempHand = hand.filter((_, i) => !indices.includes(i));

    let nextState: GameState;
    if (toDiscard === 1) {
      if (state.deck.length < 2) return;
      const d = [...state.deck];
      const openCard = d.pop()!;
      const hiddenCard = d.pop()!;
      nextState = {
        ...state,
        deck: d,
        drawPick: { openCard, hiddenCard, picksLeft: 0, tempHand, isFreeSwap: false },
        playerHands: { ...state.playerHands, [myPlayerId]: tempHand },
      };
    } else {
      if (state.deck.length < toDiscard) return;
      const newDeck = [...state.deck];
      const drawn: Card[] = [];
      for (let i = 0; i < toDiscard; i++) drawn.push(newDeck.pop()!);
      const newHand = sortHand([...tempHand, ...drawn]);
      const otherId = myPlayerId === "p1" ? "p2" : "p1";
      nextState = {
        ...state,
        deck: newDeck,
        playerHands: { ...state.playerHands, [myPlayerId]: newHand },
        currentPlayerId: otherId,
      };
    }
    setSelectedToDiscard(new Set());
    applyAndSend(nextState);
  }, [state, myPlayerId, selectedToDiscard, sessionId, applyAndSend]);

  const chooseDrawnCard = useCallback(
    (choice: "open" | "hidden") => {
      if (!state || state.phase !== "draw" || !state.drawPick || !sessionId) return;
      const { openCard, hiddenCard, picksLeft, tempHand, isFreeSwap } = state.drawPick;
      const chosen = choice === "open" ? openCard : hiddenCard;
      const other = choice === "open" ? hiddenCard : openCard;
      const newTempHand = [...tempHand, chosen];
      const deckWithBack = [...state.deck, other];
      const otherId = myPlayerId === "p1" ? "p2" : "p1";

      let nextState: GameState;
      if (picksLeft === 0) {
        nextState = {
          ...state,
          deck: deckWithBack,
          drawPick: null,
          playerHands: { ...state.playerHands, [myPlayerId]: sortHand(newTempHand) },
          currentPlayerId: isFreeSwap ? myPlayerId : otherId,
        };
      } else {
        if (deckWithBack.length < 2) return;
        const d = [...deckWithBack];
        const nextOpen = d.pop()!;
        const nextHidden = d.pop()!;
        nextState = {
          ...state,
          deck: d,
          drawPick: { openCard: nextOpen, hiddenCard: nextHidden, picksLeft: picksLeft - 1, tempHand: newTempHand, isFreeSwap },
          playerHands: { ...state.playerHands, [myPlayerId]: newTempHand },
        };
      }
      applyAndSend(nextState);
    },
    [state, myPlayerId, sessionId, applyAndSend]
  );

  const freeSwapAllFive = useCallback(() => {
    if (!state || state.phase !== "draw" || state.currentPlayerId !== myPlayerId || state.drawPick || state.drawRound !== 0 || (state.freeSwapUsedCount ?? 0) >= 3 || !sessionId) return;
    const hand = state.playerHands[myPlayerId];
    if (hand.length !== 5 || !hand.every((c) => RANK_VALUE[c.rank] <= 8) || state.deck.length < 5) return;
    const newDeck = [...state.deck];
    const drawn: Card[] = [];
    for (let i = 0; i < 5; i++) drawn.push(newDeck.pop()!);
    newDeck.push(...hand);
    const nextState: GameState = {
      ...state,
      deck: newDeck,
      playerHands: { ...state.playerHands, [myPlayerId]: sortHand(drawn) },
      freeSwapUsedCount: (state.freeSwapUsedCount ?? 0) + 1,
    };
    applyAndSend(nextState);
  }, [state, myPlayerId, sessionId, applyAndSend]);

  const doneWithDraw = useCallback(() => {
    if (!state || state.phase !== "draw" || state.currentPlayerId !== myPlayerId || !sessionId) return;
    const otherId = myPlayerId === "p1" ? "p2" : "p1";
    applyAndSend({ ...state, currentPlayerId: otherId });
    setSelectedToDiscard(new Set());
  }, [state, myPlayerId, sessionId, applyAndSend]);

  const playCard = useCallback(
    (handIndex: number) => {
      if (!state || state.phase !== "play" || !sessionId) return;
      const isLeader = state.trickCards === null;
      const activePlayer = isLeader ? state.trickLeader : getNextPlayerId(state.trickLeader, state);
      if (activePlayer !== myPlayerId) return;
      const hand = state.playerHands[myPlayerId];
      if (handIndex < 0 || handIndex >= hand.length) return;
      const card = hand[handIndex];
      if (!isLeader) {
        const [leadCard] = state.trickCards!;
        const hasLeadSuit = hand.some((c) => c.suit === leadCard.suit);
        if (hasLeadSuit && card.suit !== leadCard.suit) return;
      }
      const newHand = hand.filter((_, i) => i !== handIndex);
      const newPlayerHands = { ...state.playerHands, [myPlayerId]: newHand };

      if (isLeader) {
        applyAndSend({ ...state, playerHands: newPlayerHands, trickCards: [card, null] });
        return;
      }

      const [leadCard] = state.trickCards!;
      const trickWinner = getTrickWinner(leadCard, card, state.trickLeader, state);
      const nextTrick = state.trickNumber + 1;
      const isLastTrick = nextTrick >= 5;
      const newScores = { ...state.playerScores };
      let roundHandPoints = state.roundHandPoints;
      if (isLastTrick) {
        newScores[trickWinner] = (newScores[trickWinner] ?? 0) + 1;
        const handsForScoring = state.playPhaseHands?.p1?.length === 5 ? state.playPhaseHands : state.playerHands;
        const ids = getPlayerIds(state);
        roundHandPoints = { ...state.roundHandPoints };
        for (const id of ids) {
          const h = handsForScoring[id] ?? [];
          roundHandPoints[id] = getHandPoints(h);
          newScores[id] = (newScores[id] ?? 0) + roundHandPoints[id];
        }
      }

      const completed = [
        ...(state.completedTricks ?? []),
        { leaderCard: leadCard, followerCard: card, trickLeader: state.trickLeader, winner: trickWinner },
      ];

      applyAndSend({
        ...state,
        playerHands: newPlayerHands,
        trickCards: null,
        trickNumber: nextTrick,
        trickLeader: trickWinner,
        completedTricks: completed,
        playerScores: newScores,
        roundUtspeletWinner: isLastTrick ? trickWinner : state.roundUtspeletWinner,
        roundHandPoints,
        phase: isLastTrick ? "roundEnd" : state.phase,
      });
    },
    [state, myPlayerId, sessionId, applyAndSend]
  );

  const startNewRound = useCallback(async () => {
    if (!sessionId || state?.phase !== "roundEnd") return;
    const data = await startChicagoNewRound(sessionId);
    if (data) {
      setState(data.state);
      setMyPlayerId(data.myPlayerId as PlayerId);
    }
    setSelectedToDiscard(new Set());
  }, [sessionId, state?.phase]);

  const resetGame = useCallback(() => {}, []);

  const toggleDiscardSelection = useCallback((index: number) => {
    setSelectedToDiscard((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  return {
    state,
    loading,
    loadState,
    humanHand,
    playableCardIndices,
    selectedToDiscard,
    toggleDiscardSelection,
    confirmDiscard,
    chooseDrawnCard,
    freeSwapAllFive,
    doneWithDraw,
    playCard,
    startNewRound,
    resetGame,
    getPlayerIds: () => (state ? getPlayerIds(state) : []),
    getHandDescription,
    canConfirmDiscard,
    canFreeSwapAllFive,
    isReady: state != null && !loading,
    myPlayerId,
  };
}
