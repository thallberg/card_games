"use client";

import { useState, useCallback, useEffect } from "react";
import type { Card, PlayerId, Rank } from "../types";
import type { GameState } from "../game-state";
import {
  createInitialState,
  getPlayerIds,
  getNextPlayerId,
  applyAsk,
  applyDrawFromSjön,
  applyDrawCardFromSjön,
  applyDrawSevenIfEmpty,
} from "../game-state";

const HUMAN_PLAYER: PlayerId = "p1";

function getRanksInHand(hand: Card[]): Rank[] {
  return [...new Set(hand.map((c) => c.rank))] as Rank[];
}

/** AI: slumpmässig valör som AI har + slumpmässig spelare att fråga (alla andra lika sannolika). */
function aiChooseAsk(state: GameState, aiId: PlayerId): { to: PlayerId; rank: Rank } | null {
  const hand = state.playerHands[aiId] ?? [];
  const ranks = getRanksInHand(hand);
  if (ranks.length === 0) return null;
  const others = state.playerIds.filter((id) => id !== aiId);
  if (others.length === 0) return null;
  const rank = ranks[Math.floor(Math.random() * ranks.length)]!;
  const to = others[Math.floor(Math.random() * others.length)]!;
  return { to, rank };
}

export type PendingAskFromAI = { from: PlayerId; to: PlayerId; rank: Rank };

/** Kör ett steg AI. Om AI frågar dig (p1) returneras pendingAsk. Om AI frågar AI och "finns i sjön" returneras pendingAiDraw så att notis hinner visas. */
function runAiTurnOneStep(
  s: GameState
): { newState: GameState; pendingAsk: PendingAskFromAI | null; pendingAiDraw?: boolean } {
  if (s.phase !== "play" || s.currentPlayerId === HUMAN_PLAYER) return { newState: s, pendingAsk: null };
  const aiId = s.currentPlayerId;
  let current = applyDrawSevenIfEmpty(s, aiId);
  if ((current.playerHands[aiId] ?? []).length === 0 && current.sjön.length === 0) {
    return { newState: { ...current, currentPlayerId: getNextPlayerId(current, aiId) }, pendingAsk: null };
  }
  const hand = current.playerHands[aiId] ?? [];
  if (hand.length === 0) return { newState: current, pendingAsk: null };
  const choice = aiChooseAsk(current, aiId);
  if (!choice) return { newState: current, pendingAsk: null };
  if (choice.to === HUMAN_PLAYER) {
    return { newState: current, pendingAsk: { from: aiId, to: choice.to, rank: choice.rank } };
  }
  current = applyAsk(current, aiId, choice.to, choice.rank);
  if (current.lastWasFinnsISjon) {
    return { newState: current, pendingAsk: null, pendingAiDraw: true };
  }
  return { newState: current, pendingAsk: null };
}

const AI_ASK_DELAY_MS = 2000;
/** Kort paus innan AI gör drag så att turordningen (p2 → p3 → p4) syns i UI. */
const AI_TURN_DELAY_MS = 800;

export function useFinnsisjonGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [pendingAskFromAI, setPendingAskFromAI] = useState<PendingAskFromAI | null>(null);
  const [pendingAiDrawState, setPendingAiDrawState] = useState<GameState | null>(null);
  const [pendingAiDrawStep, setPendingAiDrawStep] = useState<0 | 1 | 2>(0);
  const [lastAiAskWasFinnsISjon, setLastAiAskWasFinnsISjon] = useState(false);

  const startGame = useCallback((numPlayers: number) => {
    setPlayerCount(numPlayers);
    setState(createInitialState(numPlayers));
  }, []);

  const resetGame = useCallback(() => {
    if (playerCount !== null) setState(createInitialState(playerCount));
  }, [playerCount]);

  const askForRank = useCallback(
    (to: PlayerId, rank: Rank) => {
      if (!state || state.phase !== "play" || state.currentPlayerId !== HUMAN_PLAYER) return;
      setLastAiAskWasFinnsISjon(false);
      const next = applyAsk(state, HUMAN_PLAYER, to, rank);
      setState(next);
    },
    [state]
  );

  const drawCardFromSjön = useCallback(
    (cardIndex: number) => {
      if (!state || state.phase !== "play" || !state.lastWasFinnsISjon) return;
      setLastAiAskWasFinnsISjon(false);
      const next = applyDrawCardFromSjön(state, state.currentPlayerId, cardIndex);
      setState(next);
    },
    [state]
  );

  const humanHand = state?.playerHands[HUMAN_PLAYER] ?? [];
  const isHumanTurn = state?.phase === "play" && state?.currentPlayerId === HUMAN_PLAYER;
  const ranksIHave = getRanksInHand(humanHand);
  const canAsk = isHumanTurn && !state?.lastWasFinnsISjon && ranksIHave.length > 0;
  const mustDrawFromSjön = isHumanTurn && state?.lastWasFinnsISjon === true;

  useEffect(() => {
    if (!state || state.phase !== "play" || state.currentPlayerId === HUMAN_PLAYER || state.lastWasFinnsISjon || pendingAskFromAI || pendingAiDrawState)
      return;
    const timer = setTimeout(() => {
      const result = runAiTurnOneStep(state);
      const { newState, pendingAsk, pendingAiDraw } = result;
      if (pendingAsk) {
        setLastAiAskWasFinnsISjon(false);
        setPendingAskFromAI(pendingAsk);
        return;
      }
      if (pendingAiDraw) {
        setState(newState);
        setPendingAiDrawState(newState);
        setPendingAiDrawStep(0);
        return;
      }
      if (newState !== state) setState(newState);
    }, AI_TURN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state, pendingAskFromAI, pendingAiDrawState]);

  useEffect(() => {
    if (!pendingAiDrawState) return;
    const step = pendingAiDrawStep;
    const timer = setTimeout(() => {
      if (step === 0) {
        setPendingAiDrawStep(1);
      } else if (step === 1) {
        setPendingAiDrawStep(2);
      } else {
        const next = applyDrawFromSjön(pendingAiDrawState, pendingAiDrawState.currentPlayerId);
        setState(next);
        setPendingAiDrawState(null);
        setPendingAiDrawStep(0);
      }
    }, AI_ASK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pendingAiDrawState, pendingAiDrawStep]);

  useEffect(() => {
    if (!pendingAskFromAI || !state) return;
    const pending = pendingAskFromAI;
    const timer = setTimeout(() => {
      let next = applyAsk(state, pending.from, pending.to, pending.rank);
      const wasFinnsISjon = next.lastWasFinnsISjon;
      if (wasFinnsISjon) {
        setLastAiAskWasFinnsISjon(true);
        next = applyDrawFromSjön(next, pending.from);
      } else {
        setLastAiAskWasFinnsISjon(false);
      }
      setState(next);
      setPendingAskFromAI(null);
    }, AI_ASK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pendingAskFromAI, state]);

  useEffect(() => {
    if (!state || state.phase !== "play" || state.currentPlayerId !== HUMAN_PLAYER) return;
    const hand = state.playerHands[HUMAN_PLAYER] ?? [];
    if (hand.length > 0) return;
    if (state.sjön.length > 0) {
      setState(applyDrawSevenIfEmpty(state, HUMAN_PLAYER));
      return;
    }
    setState({ ...state, currentPlayerId: getNextPlayerId(state, HUMAN_PLAYER) });
  }, [state]);

  return {
    state,
    playerCount,
    humanHand,
    isHumanTurn,
    canAsk,
    mustDrawFromSjön,
    pendingAskFromAI,
    pendingAiDrawStep,
    lastAiAskWasFinnsISjon,
    startGame,
    resetGame,
    askForRank,
    drawCardFromSjön,
    getPlayerIds: () => (state ? getPlayerIds(state) : []),
  };
}
