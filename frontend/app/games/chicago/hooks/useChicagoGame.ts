"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Card, PlayerId } from "../types";
import type { GameState } from "../game-state";
import { RANK_VALUE } from "../types";
import {
  createInitialState,
  getPlayerIds,
  getNextPlayerId,
} from "../game-state";
import { createDeck, shuffle, sortHand } from "../deck";
import { getHandPoints, getHandDescription } from "../hand-score";
import { HAND_SIZE, MAX_DRAW_ROUNDS } from "../constants";

const HUMAN: PlayerId = "p1";
const AI: PlayerId = "p2";

export function useChicagoGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [selectedToDiscard, setSelectedToDiscard] = useState<Set<number>>(new Set());
  const aiThinking = useRef(false);

  useEffect(() => {
    setState(createInitialState());
  }, []);

  const humanHand = state?.playerHands[HUMAN] ?? [];
  const playableCardIndices = (() => {
    if (!state || state.phase !== "play") return new Set<number>();
    const isLeader = state.trickCards === null;
    const active = isLeader ? state.trickLeader : getNextPlayerId(state.trickLeader);
    if (active !== HUMAN) return new Set<number>();
    const hand = state.playerHands[HUMAN];
    if (hand.length === 0) return new Set<number>();
    if (isLeader) return new Set(hand.map((_, i) => i));
    const leadCard = state.trickCards![0];
    const sameSuitIndices = hand
      .map((c, i) => (c.suit === leadCard.suit ? i : -1))
      .filter((i) => i >= 0);
    if (sameSuitIndices.length > 0) return new Set(sameSuitIndices);
    return new Set(hand.map((_, i) => i));
  })();
  const canConfirmDiscard =
    state?.phase === "draw" &&
    state.currentPlayerId === HUMAN &&
    !state?.drawPick &&
    selectedToDiscard.size >= 1 &&
    selectedToDiscard.size <= humanHand.length &&
    (selectedToDiscard.size === 1 ? (state?.deck.length ?? 0) >= 2 : (state?.deck.length ?? 0) >= selectedToDiscard.size);
  const canFreeSwapAllFive =
    state?.phase === "draw" &&
    state?.currentPlayerId === HUMAN &&
    !state?.drawPick &&
    state?.drawRound === 0 &&
    (state?.freeSwapUsedCount ?? 0) < 3 &&
    humanHand.length === 5 &&
    humanHand.every((c) => RANK_VALUE[c.rank] <= 8);

  const confirmDiscard = useCallback(() => {
    setState((s) => {
      if (!s || s.phase !== "draw" || s.currentPlayerId !== HUMAN || s.drawPick) return s;
      const hand = s.playerHands[HUMAN];
      const indices = [...selectedToDiscard].filter((i) => i >= 0 && i < hand.length).sort((a, b) => b - a);
      const toDiscard = indices.length;
      if (toDiscard <= 0) return s;
      const tempHand = hand.filter((_, i) => !indices.includes(i));

      if (toDiscard === 1) {
        if (s.deck.length < 2) return s;
        const d = [...s.deck];
        const openCard = d.pop()!;
        const hiddenCard = d.pop()!;
        return {
          ...s,
          deck: d,
          drawPick: { openCard, hiddenCard, picksLeft: 0, tempHand, isFreeSwap: false },
          playerHands: { ...s.playerHands, [HUMAN]: tempHand },
          lastOpponentDiscardCount: undefined,
        };
      }

      if (s.deck.length < toDiscard) return s;
      const newDeck = [...s.deck];
      const drawn: Card[] = [];
      for (let i = 0; i < toDiscard; i++) drawn.push(newDeck.pop()!);
      const newHand = sortHand([...tempHand, ...drawn]);
      return {
        ...s,
        deck: newDeck,
        playerHands: { ...s.playerHands, [HUMAN]: newHand },
        currentPlayerId: AI,
        lastOpponentDiscardCount: undefined,
      };
    });
    setSelectedToDiscard(new Set());
  }, [selectedToDiscard]);

  const chooseDrawnCard = useCallback((choice: "open" | "hidden") => {
    setState((s) => {
      if (!s || s.phase !== "draw" || !s.drawPick) return s;
      const { openCard, hiddenCard, picksLeft, tempHand, isFreeSwap } = s.drawPick;
      const chosen = choice === "open" ? openCard : hiddenCard;
      const other = choice === "open" ? hiddenCard : openCard;
      const newTempHand = [...tempHand, chosen];
      const deckWithBack = [...s.deck, other];

      if (picksLeft === 0) {
        return {
          ...s,
          deck: deckWithBack,
          drawPick: null,
          playerHands: { ...s.playerHands, [HUMAN]: sortHand(newTempHand) },
          currentPlayerId: isFreeSwap ? HUMAN : AI,
        };
      }

      if (deckWithBack.length < 2) return s;
      const d = [...deckWithBack];
      const nextOpen = d.pop()!;
      const nextHidden = d.pop()!;
      return {
        ...s,
        deck: d,
        drawPick: { openCard: nextOpen, hiddenCard: nextHidden, picksLeft: picksLeft - 1, tempHand: newTempHand, isFreeSwap },
        playerHands: { ...s.playerHands, [HUMAN]: newTempHand },
      };
    });
  }, []);

  const freeSwapAllFive = useCallback(() => {
    setState((s) => {
      if (!s || s.phase !== "draw" || s.currentPlayerId !== HUMAN || s.drawPick) return s;
      if (s.drawRound !== 0 || (s.freeSwapUsedCount ?? 0) >= 3) return s;
      const hand = s.playerHands[HUMAN];
      if (hand.length !== 5) return s;
      const allTenOrLower = hand.every((c) => RANK_VALUE[c.rank] <= 8);
      if (!allTenOrLower) return s;
      if (s.deck.length < 5) return s;
      const newDeck = [...s.deck];
      const drawn: Card[] = [];
      for (let i = 0; i < 5; i++) drawn.push(newDeck.pop()!);
      newDeck.push(...hand);
      return {
        ...s,
        deck: newDeck,
        playerHands: { ...s.playerHands, [HUMAN]: sortHand(drawn) },
        freeSwapUsedCount: (s.freeSwapUsedCount ?? 0) + 1,
      };
    });
  }, []);

  const doneWithDraw = useCallback(() => {
    setState((s) => {
      if (!s || s.phase !== "draw" || s.currentPlayerId !== HUMAN) return s;
      return { ...s, currentPlayerId: AI };
    });
    setSelectedToDiscard(new Set());
  }, []);

  const playCard = useCallback((handIndex: number) => {
    setState((s) => {
      if (!s || s.phase !== "play") return s;
      const isLeader = s.trickCards === null;
      const activePlayer = isLeader ? s.trickLeader : getNextPlayerId(s.trickLeader);
      if (activePlayer !== HUMAN) return s;
      const hand = s.playerHands[HUMAN];
      if (handIndex < 0 || handIndex >= hand.length) return s;
      const card = hand[handIndex];
      if (!isLeader) {
        const [leadCard] = s.trickCards!;
        const hasLeadSuit = hand.some((c) => c.suit === leadCard.suit);
        if (hasLeadSuit && card.suit !== leadCard.suit) return s;
      }
      const newHand = hand.filter((_, i) => i !== handIndex);
      const newPlayerHands = { ...s.playerHands, [HUMAN]: newHand };

      if (isLeader) {
        return {
          ...s,
          playerHands: newPlayerHands,
          trickCards: [card, null],
        };
      }

      const [leadCard, _] = s.trickCards!;
      const trickWinner = getTrickWinner(leadCard, card, s.trickLeader);
      const nextTrick = s.trickNumber + 1;
      const isLastTrick = nextTrick >= 5;
      const newScores = { ...s.playerScores };
      let roundHandPoints = s.roundHandPoints;
      if (isLastTrick) {
        newScores[trickWinner] = (newScores[trickWinner] ?? 0) + 1;
        const handsForScoring = s.playPhaseHands?.p1?.length === 5 ? s.playPhaseHands : s.playerHands;
        const humanHand = handsForScoring[HUMAN] ?? [];
        const aiHand = handsForScoring[AI] ?? [];
        const humanPoints = getHandPoints(humanHand);
        const aiPoints = getHandPoints(aiHand);
        roundHandPoints = { p1: humanPoints, p2: aiPoints };
        newScores[HUMAN] = (newScores[HUMAN] ?? 0) + humanPoints;
        newScores[AI] = (newScores[AI] ?? 0) + aiPoints;
      }

      const completed = [
        ...(s.completedTricks ?? []),
        { leaderCard: leadCard, followerCard: card, trickLeader: s.trickLeader, winner: trickWinner },
      ];

      return {
        ...s,
        playerHands: newPlayerHands,
        trickCards: null,
        trickNumber: nextTrick,
        trickLeader: trickWinner,
        completedTricks: completed,
        playerScores: newScores,
        roundUtspeletWinner: isLastTrick ? trickWinner : s.roundUtspeletWinner,
        roundHandPoints,
        phase: isLastTrick ? "roundEnd" : s.phase,
      };
    });
  }, []);

  const toggleDiscardSelection = useCallback((index: number) => {
    setSelectedToDiscard((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const startNewRound = useCallback(() => {
    setState((s) => {
      if (!s || s.phase !== "roundEnd") return s;
      const fullDeck = shuffle(createDeck());
      const hands = {
        p1: sortHand(fullDeck.slice(0, HAND_SIZE)),
        p2: sortHand(fullDeck.slice(HAND_SIZE, HAND_SIZE * 2)),
      };
      return {
        ...s,
        phase: "draw",
        deck: fullDeck.slice(HAND_SIZE * 2),
        playerHands: hands,
        drawRound: 0,
        drawPick: null,
        freeSwapUsedCount: 0,
        currentPlayerId: HUMAN,
        trickNumber: 0,
        trickLeader: "p2",
        trickCards: null,
        completedTricks: [],
        roundUtspeletWinner: null,
        roundHandPoints: { p1: 0, p2: 0 },
        playPhaseHands: { p1: [], p2: [] },
        rondNumber: s.rondNumber + 1,
        lastOpponentDiscardCount: undefined,
      };
    });
    setSelectedToDiscard(new Set());
  }, []);

  const resetGame = useCallback(() => {
    setState(createInitialState());
    setSelectedToDiscard(new Set());
  }, []);

  useEffect(() => {
    if (!state || state.phase !== "draw" || state.currentPlayerId !== AI) return;
    if (aiThinking.current) return;
    aiThinking.current = true;
    const t = setTimeout(() => {
      setState((s) => {
        if (!s || s.phase !== "draw" || s.currentPlayerId !== AI) return s;
        const hand = s.playerHands[AI];
        const toDiscard = Math.min(2, Math.floor(Math.random() * 4));
        if (toDiscard === 0 || s.deck.length < toDiscard) {
          const nextRound = s.drawRound + 1;
          const allRoundsDone = nextRound >= MAX_DRAW_ROUNDS;
          return {
            ...s,
            drawRound: nextRound,
            phase: allRoundsDone ? "play" : s.phase,
            trickLeader: allRoundsDone ? "p2" : s.trickLeader,
            currentPlayerId: HUMAN,
            playPhaseHands: allRoundsDone ? { ...s.playerHands } : s.playPhaseHands,
            lastOpponentDiscardCount: 0,
          };
        }
        const indices: number[] = [];
        while (indices.length < toDiscard) {
          const i = Math.floor(Math.random() * hand.length);
          if (!indices.includes(i)) indices.push(i);
        }
        const discardedCards = indices.map((i) => hand[i]);
        const newDeck = [...s.deck];
        const newHand = hand.filter((_, i) => !indices.includes(i));
        for (let i = 0; i < toDiscard && newDeck.length > 0; i++) {
          newHand.push(newDeck.pop()!);
        }
        const nextHands = { ...s.playerHands, [AI]: sortHand(newHand) };
        const nextRound = s.drawRound + 1;
        const allRoundsDone = nextRound >= MAX_DRAW_ROUNDS;
        return {
          ...s,
          deck: newDeck,
          playerHands: nextHands,
          drawRound: nextRound,
          phase: allRoundsDone ? "play" : s.phase,
          trickLeader: allRoundsDone ? "p2" : s.trickLeader,
          currentPlayerId: HUMAN,
          playPhaseHands: allRoundsDone ? nextHands : s.playPhaseHands,
          lastOpponentDiscardCount: discardedCards.length,
        };
      });
      aiThinking.current = false;
    }, 800);
    return () => clearTimeout(t);
  }, [state?.phase, state?.currentPlayerId, state?.drawRound]);

  useEffect(() => {
    if (!state || state.phase !== "play") return;
    const isLeader = state.trickCards === null;
    const active = isLeader ? state.trickLeader : getNextPlayerId(state.trickLeader);
    if (active !== AI) return;
    if (aiThinking.current) return;
    aiThinking.current = true;
    const t = setTimeout(() => {
      setState((s) => {
        if (!s || s.phase !== "play") return s;
        const isLead = s.trickCards === null;
        const activePlayer = isLead ? s.trickLeader : getNextPlayerId(s.trickLeader);
        if (activePlayer !== AI) return s;
        const hand = s.playerHands[AI];
        if (hand.length === 0) return s;
        let playIndex = 0;
        if (!isLead && s.trickCards) {
          const [leadCard] = s.trickCards;
          const sameSuit = hand.filter((c) => c.suit === leadCard.suit);
          if (sameSuit.length > 0) {
            const leadVal = RANK_VALUE[leadCard.rank];
            const better = sameSuit.find((c) => RANK_VALUE[c.rank] > leadVal);
            playIndex = hand.indexOf(better ?? sameSuit[sameSuit.length - 1]);
          } else {
            playIndex = Math.floor(Math.random() * hand.length);
          }
        } else {
          playIndex = Math.floor(Math.random() * hand.length);
        }
        const card = hand[playIndex];
        const newHand = hand.filter((_, i) => i !== playIndex);
        const newPlayerHands = { ...s.playerHands, [AI]: newHand };

        if (isLead) {
          return {
            ...s,
            playerHands: newPlayerHands,
            trickCards: [card, null],
          };
        }

        const [leadCard] = s.trickCards!;
        const trickWinner = getTrickWinner(leadCard, card, s.trickLeader);
        const nextTrick = s.trickNumber + 1;
        const isLastTrick = nextTrick >= 5;
        const newScores = { ...s.playerScores };
        let roundHandPoints = s.roundHandPoints;
        if (isLastTrick) {
          newScores[trickWinner] = (newScores[trickWinner] ?? 0) + 1;
          const handsForScoring = s.playPhaseHands?.p1?.length === 5 ? s.playPhaseHands : s.playerHands;
          const humanHand = handsForScoring[HUMAN] ?? [];
          const aiHand = handsForScoring[AI] ?? [];
          const humanPoints = getHandPoints(humanHand);
          const aiPoints = getHandPoints(aiHand);
          roundHandPoints = { p1: humanPoints, p2: aiPoints };
          newScores[HUMAN] = (newScores[HUMAN] ?? 0) + humanPoints;
          newScores[AI] = (newScores[AI] ?? 0) + aiPoints;
        }

        const completed = [
          ...(s.completedTricks ?? []),
          { leaderCard: leadCard, followerCard: card, trickLeader: s.trickLeader, winner: trickWinner },
        ];

        return {
          ...s,
          playerHands: newPlayerHands,
          trickCards: null,
          trickNumber: nextTrick,
          trickLeader: trickWinner,
          completedTricks: completed,
          playerScores: newScores,
          roundUtspeletWinner: isLastTrick ? trickWinner : s.roundUtspeletWinner,
          roundHandPoints,
          phase: isLastTrick ? "roundEnd" : s.phase,
        };
      });
      aiThinking.current = false;
    }, 600);
    return () => clearTimeout(t);
  }, [state?.phase, state?.trickCards, state?.trickLeader, state?.trickNumber]);

  return {
    state,
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
    getPlayerIds,
    getHandDescription,
    canConfirmDiscard,
    canFreeSwapAllFive,
  };
}

function getTrickWinner(lead: Card, follow: Card, leader: PlayerId): PlayerId {
  const leadSuit = lead.suit;
  const followSuit = follow.suit;
  if (followSuit !== leadSuit) return leader;
  if (RANK_VALUE[follow.rank] > RANK_VALUE[lead.rank]) return getNextPlayerId(leader);
  return leader;
}
