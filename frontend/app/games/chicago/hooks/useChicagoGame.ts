"use client";

import { useState, useCallback, useEffect } from "react";
import type { Card, PlayerId } from "../types";
import type { GameState } from "../game-state";
import { RANK_VALUE } from "../types";
import {
  createInitialState,
  getPlayerIds,
  getNextPlayerId,
  getTrickWinner,
} from "../game-state";
import { createDeck, shuffle, sortHand } from "../deck";
import { dealHandsFromShuffledDeckStart } from "@/lib/deal";
import { getHandPoints, getHandDescription } from "../hand-score";
import { HAND_SIZE, MAX_DRAW_ROUNDS } from "../constants";
import { useDelayedSingleFlight } from "@/hooks/useDelayedSingleFlight";

const HUMAN: PlayerId = "p1";

export function useChicagoGame(playerCount: number = 2) {
  const [state, setState] = useState<GameState | null>(null);
  const [selectedToDiscard, setSelectedToDiscard] = useState<Set<number>>(new Set());

  useEffect(() => {
    setState(createInitialState(playerCount));
  }, [playerCount]);

  const humanHand = state?.playerHands[HUMAN] ?? [];
  const playableCardIndices = (() => {
    if (!state || state.phase !== "play") return new Set<number>();
    const isLeader = state.trickCards === null;
    const active = isLeader ? state.trickLeader : getNextPlayerId(state.trickLeader, state);
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
        currentPlayerId: getNextPlayerId(HUMAN, s),
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
          currentPlayerId: isFreeSwap ? HUMAN : getNextPlayerId(HUMAN, s),
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
      return { ...s, currentPlayerId: getNextPlayerId(HUMAN, s) };
    });
    setSelectedToDiscard(new Set());
  }, []);

  const playCard = useCallback((handIndex: number) => {
    setState((s) => {
      if (!s || s.phase !== "play") return s;
      const isLeader = s.trickCards === null;
      const activePlayer = isLeader ? s.trickLeader : getNextPlayerId(s.trickLeader, s);
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
      const trickWinner = getTrickWinner(leadCard, card, s.trickLeader, s);
      const nextTrick = s.trickNumber + 1;
      const isLastTrick = nextTrick >= 5;
      const newScores = { ...s.playerScores };
      let roundHandPoints = s.roundHandPoints;
      if (isLastTrick) {
        newScores[trickWinner] = (newScores[trickWinner] ?? 0) + 1;
        const handsForScoring = s.playPhaseHands?.p1?.length === 5 ? s.playPhaseHands : s.playerHands;
        const ids = getPlayerIds(s);
        roundHandPoints = { ...s.roundHandPoints };
        for (const id of ids) {
          const h = handsForScoring[id] ?? [];
          roundHandPoints[id] = getHandPoints(h);
          newScores[id] = (newScores[id] ?? 0) + roundHandPoints[id];
        }
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
      const playerIds = getPlayerIds(s);
      const fullDeck = shuffle(createDeck());
      const { hands, remainingDeck: deckAfterDeal } = dealHandsFromShuffledDeckStart({
        deck: fullDeck,
        playerIds,
        handSize: HAND_SIZE,
        sortHand,
      });
      const roundPoints: Record<PlayerId, number> = {} as Record<PlayerId, number>;
      const playHands: Record<PlayerId, Card[]> = {} as Record<PlayerId, Card[]>;
      for (const id of playerIds) {
        roundPoints[id] = 0;
        playHands[id] = [];
      }
      return {
        ...s,
        phase: "draw",
        deck: deckAfterDeal,
        playerHands: hands,
        drawRound: 0,
        drawPick: null,
        freeSwapUsedCount: 0,
        currentPlayerId: HUMAN,
        trickNumber: 0,
        trickLeader: playerIds[1] ?? "p2",
        trickCards: null,
        completedTricks: [],
        roundUtspeletWinner: null,
        roundHandPoints: roundPoints,
        playPhaseHands: playHands,
        rondNumber: s.rondNumber + 1,
        lastOpponentDiscardCount: undefined,
      };
    });
    setSelectedToDiscard(new Set());
  }, []);

  const resetGame = useCallback(() => {
    setState(createInitialState(playerCount));
    setSelectedToDiscard(new Set());
  }, [playerCount]);

  useDelayedSingleFlight({
    enabled: !!state && state.phase === "draw" && state.currentPlayerId !== HUMAN,
    delayMs: 800,
    onFire: () => {
      setState((s) => {
        if (!s || s.phase !== "draw" || s.currentPlayerId === HUMAN) return s;
        const aiId = s.currentPlayerId;
        const hand = s.playerHands[aiId] ?? [];
        const toDiscard = Math.min(2, Math.floor(Math.random() * 4));
        const playerIds = getPlayerIds(s);
        if (toDiscard === 0 || s.deck.length < toDiscard) {
          const nextRound = s.drawRound + 1;
          const allRoundsDone = nextRound >= MAX_DRAW_ROUNDS;
          return {
            ...s,
            drawRound: nextRound,
            phase: allRoundsDone ? "play" : s.phase,
            trickLeader: allRoundsDone ? (playerIds[1] ?? s.trickLeader) : s.trickLeader,
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
        const nextHands = { ...s.playerHands, [aiId]: sortHand(newHand) };
        const nextRound = s.drawRound + 1;
        const allRoundsDone = nextRound >= MAX_DRAW_ROUNDS;
        return {
          ...s,
          deck: newDeck,
          playerHands: nextHands,
          drawRound: nextRound,
          phase: allRoundsDone ? "play" : s.phase,
          trickLeader: allRoundsDone ? (playerIds[1] ?? s.trickLeader) : s.trickLeader,
          currentPlayerId: HUMAN,
          playPhaseHands: allRoundsDone ? nextHands : s.playPhaseHands,
          lastOpponentDiscardCount: discardedCards.length,
        };
      });
    },
  });

  useDelayedSingleFlight({
    enabled: (() => {
      if (!state || state.phase !== "play") return false;
      const isLeader = state.trickCards === null;
      const active = isLeader ? state.trickLeader : getNextPlayerId(state.trickLeader, state);
      return active !== HUMAN;
    })(),
    delayMs: 600,
    onFire: () => {
      setState((s) => {
        if (!s || s.phase !== "play") return s;
        const isLead = s.trickCards === null;
        const activePlayer = isLead ? s.trickLeader : getNextPlayerId(s.trickLeader, s);
        if (activePlayer === HUMAN) return s;
        const aiId = activePlayer;
        const hand = s.playerHands[aiId] ?? [];
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
        const newPlayerHands = { ...s.playerHands, [aiId]: newHand };

        if (isLead) {
          return {
            ...s,
            playerHands: newPlayerHands,
            trickCards: [card, null],
          };
        }

        const [leadCard] = s.trickCards!;
        const trickWinner = getTrickWinner(leadCard, card, s.trickLeader, s);
        const nextTrick = s.trickNumber + 1;
        const isLastTrick = nextTrick >= 5;
        const newScores = { ...s.playerScores };
        let roundHandPoints = { ...s.roundHandPoints };
        if (isLastTrick) {
          newScores[trickWinner] = (newScores[trickWinner] ?? 0) + 1;
          const handsForScoring = s.playPhaseHands?.p1?.length === 5 ? s.playPhaseHands : s.playerHands;
          const ids = getPlayerIds(s);
          for (const id of ids) {
            const h = handsForScoring[id] ?? [];
            roundHandPoints[id] = getHandPoints(h);
            newScores[id] = (newScores[id] ?? 0) + roundHandPoints[id];
          }
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
    },
  });

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
    getPlayerIds: () => (state ? getPlayerIds(state) : []),
    getHandDescription,
    canConfirmDiscard,
    canFreeSwapAllFive,
  };
}
