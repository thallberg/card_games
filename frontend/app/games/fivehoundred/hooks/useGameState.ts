"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Card, PlayerId } from "../types";
import type { GameState } from "../game-state";
import {
  createInitialState,
  createNewRoundState,
  getPlayerIds,
  getNextPlayerId,
  checkGameOver,
} from "../game-state";
import { sortHand } from "../deck";
import { getMeldType, canAddCardToMeld } from "../melds";
import { getHandPenalty, getMeldPoints } from "../scoring";

const HUMAN_PLAYER: PlayerId = "p1";

export function useGameState() {
  const [state, setState] = useState<GameState | null>(null);
  const [lastDrawnCard, setLastDrawnCard] = useState<Card | null>(null);
  const lastDrawnRef = useRef<Card | null>(null);

  useEffect(() => {
    setState(createInitialState());
  }, []);

  const flushLastDrawn = useCallback(() => {
    if (lastDrawnRef.current) {
      setLastDrawnCard(lastDrawnRef.current);
      lastDrawnRef.current = null;
    } else {
      setLastDrawnCard(null);
    }
  }, []);

  const drawFromStock = useCallback(() => {
    setState((s) => {
      if (s == null) return s;
      if (s.phase !== "draw" || s.currentPlayerId !== HUMAN_PLAYER || s.stock.length === 0)
        return s;
      const card = s.stock[s.stock.length - 1];
      lastDrawnRef.current = card;
      return {
        ...s,
        stock: s.stock.slice(0, -1),
        playerHands: {
          ...s.playerHands,
          [HUMAN_PLAYER]: sortHand([...s.playerHands[HUMAN_PLAYER], card]),
        },
        phase: "meldOrDiscard",
        lastDraw: "stock",
      };
    });
    queueMicrotask(flushLastDrawn);
  }, [flushLastDrawn]);

  const takeDiscardPile = useCallback(() => {
    setState((s) => {
      if (s == null) return s;
      if (s.phase !== "draw" || s.currentPlayerId !== HUMAN_PLAYER || s.discard.length === 0)
        return s;
      const topCard = s.discard[0];
      const newHand = [...s.playerHands[HUMAN_PLAYER], ...s.discard];
      lastDrawnRef.current = topCard;
      return {
        ...s,
        discard: [],
        playerHands: { ...s.playerHands, [HUMAN_PLAYER]: sortHand(newHand) },
        phase: "meldOrDiscard",
        lastDraw: "discard",
      };
    });
    queueMicrotask(flushLastDrawn);
  }, [flushLastDrawn]);

  const skipDraw = useCallback(() => {
    lastDrawnRef.current = null;
    setLastDrawnCard(null);
    setState((s) => {
      if (s == null) return s;
      if (s.phase !== "draw" || s.currentPlayerId !== HUMAN_PLAYER || s.stock.length !== 0)
        return s;
      return { ...s, phase: "meldOrDiscard", lastDraw: null };
    });
  }, []);

  const advanceTurn = useCallback((s: GameState): GameState => {
    if (s.currentPlayerId == null) return s;
    const nextId = getNextPlayerId(s.currentPlayerId);
    return {
      ...s,
      currentPlayerId: nextId,
      phase: "draw",
      lastDraw: null,
    };
  }, []);

  const discardCard = useCallback((handIndex: number) => {
    lastDrawnRef.current = null;
    setLastDrawnCard(null);
    setState((s) => {
      if (s == null) return s;
      if (s.phase !== "meldOrDiscard" || s.currentPlayerId !== HUMAN_PLAYER)
        return s;
      const hand = s.playerHands[HUMAN_PLAYER];
      if (handIndex < 0 || handIndex >= hand.length) return s;
      const cardToDiscard = hand[handIndex];
      const newHand = hand.filter((_, i) => i !== handIndex);
      const newDiscard = [cardToDiscard, ...s.discard];
      const newPlayerHands = {
        ...s.playerHands,
        [HUMAN_PLAYER]: newHand,
      };
      const updated = {
        ...s,
        discard: newDiscard,
        playerHands: newPlayerHands,
      };
      if (newHand.length === 0) {
        let myMeldPoints = 0;
        for (const m of updated.melds) {
          if (m.ownerId === HUMAN_PLAYER) myMeldPoints += getMeldPoints(m.cards);
        }
        const newScores = { ...updated.playerScores };
        newScores[HUMAN_PLAYER] = (newScores[HUMAN_PLAYER] ?? 0) + myMeldPoints;
        const ids = getPlayerIds();
        for (const id of ids) {
          if (id === HUMAN_PLAYER) continue;
          const penalty = getHandPenalty(updated.playerHands[id] ?? []);
          newScores[id] = (newScores[id] ?? 0) - penalty;
        }
        const gameWinner = checkGameOver(newScores);
        return {
          ...updated,
          playerScores: newScores,
          phase: gameWinner != null ? ("gameOver" as const) : ("roundEnd" as const),
          winnerId: gameWinner ?? HUMAN_PLAYER,
        };
      }
      const gameWinner = checkGameOver(s.playerScores);
      const next = advanceTurn(updated);
      return gameWinner != null ? { ...next, winnerId: gameWinner } : next;
    });
  }, [advanceTurn]);

  const passWithoutDiscard = useCallback(() => {
    lastDrawnRef.current = null;
    setLastDrawnCard(null);
    setState((s) => {
      if (s == null) return s;
      if (s.phase !== "meldOrDiscard" || s.currentPlayerId !== HUMAN_PLAYER)
        return s;
      return advanceTurn(s);
    });
  }, [advanceTurn]);

  const addMeld = useCallback((cardIndices: number[], wildRepresents?: Record<number, Card>) => {
    lastDrawnRef.current = null;
    setLastDrawnCard(null);
    setState((s) => {
      if (s == null) return s;
      if (s.phase !== "meldOrDiscard" || s.currentPlayerId !== HUMAN_PLAYER)
        return s;
      const hand = s.playerHands[HUMAN_PLAYER];
      const indices = [...cardIndices].sort((a, b) => a - b).filter((i) => i >= 0 && i < hand.length);
      if (indices.length < 3) return s;
      const cards = indices.map((i) => hand[i]);
      const type = getMeldType(cards);
      if (type == null) return s;
      const newHand = hand.filter((_, i) => !indices.includes(i));
      const newMeld: import("../types").Meld = {
        id: crypto.randomUUID(),
        cards,
        type,
        ownerId: HUMAN_PLAYER,
        ...(wildRepresents && Object.keys(wildRepresents).length > 0 ? { wildRepresents } : undefined),
      };
      return {
        ...s,
        playerHands: { ...s.playerHands, [HUMAN_PLAYER]: newHand },
        melds: [...s.melds, newMeld],
      };
    });
  }, []);

  const addCardToExistingMeld = useCallback((meldId: string, handIndex: number, wildAs?: import("../types").Card) => {
    lastDrawnRef.current = null;
    setLastDrawnCard(null);
    setState((s) => {
      if (s == null) return s;
      if (s.phase !== "meldOrDiscard" || s.currentPlayerId !== HUMAN_PLAYER)
        return s;
      const hand = s.playerHands[HUMAN_PLAYER];
      if (handIndex < 0 || handIndex >= hand.length) return s;
      const meld = s.melds.find((m) => m.id === meldId);
      if (meld == null) return s;
      const card = hand[handIndex];
      if (!canAddCardToMeld(card, meld)) return s;
      const newHand = hand.filter((_, i) => i !== handIndex);
      const newCards = [...meld.cards, card];
      if (meld.type === "run") {
        const RANK_ORDER: Record<string, number> = {
          "2": 0, "3": 1, "4": 2, "5": 3, "6": 4, "7": 5, "8": 6, "9": 7,
          "10": 8, jack: 9, queen: 10, king: 11, ace: 12,
        };
        const isWild = (c: import("../types").Card) => c.rank === "2";
        newCards.sort((a, b) => {
          const va = isWild(a) ? -1 : RANK_ORDER[a.rank];
          const vb = isWild(b) ? -1 : RANK_ORDER[b.rank];
          return va - vb;
        });
      }
      const newIndex = newCards.length - 1;
      const newWildRepresents = wildAs && card.rank === "2"
        ? { ...meld.wildRepresents, [newIndex]: wildAs }
        : meld.wildRepresents;
      const newMelds = s.melds.map((m) =>
        m.id === meldId ? { ...m, cards: newCards, wildRepresents: newWildRepresents } : m
      );
      return {
        ...s,
        playerHands: { ...s.playerHands, [HUMAN_PLAYER]: newHand },
        melds: newMelds,
      };
    });
  }, []);

  /** För test: avancera till nästa spelare (t.ex. när det är p2/p3 tur). */
  const advanceToNextTurn = useCallback(() => {
    setState((s) => {
      if (s == null) return s;
      if (s.phase !== "draw" || s.currentPlayerId === HUMAN_PLAYER) return s;
      return advanceTurn(s);
    });
  }, [advanceTurn]);

  const resetGame = useCallback(() => {
    setState(createInitialState());
  }, []);

  const startNewRound = useCallback(() => {
    lastDrawnRef.current = null;
    setLastDrawnCard(null);
    setState((s) => {
      if (s == null || s.phase !== "roundEnd") return s;
      const next = createNewRoundState(s);
      const gameWinner = checkGameOver(next.playerScores);
      return gameWinner != null ? { ...next, phase: "gameOver" as const, winnerId: gameWinner } : next;
    });
  }, []);

  const humanHand = state?.playerHands[HUMAN_PLAYER] ?? [];
  const topDiscard = state && state.discard.length > 0 ? state.discard[0] : null;

  return {
    state,
    isReady: state != null,
    humanHand,
    topDiscard,
    isHumanTurn: state != null && state.phase !== "roundEnd" && state.phase !== "gameOver" && state.currentPlayerId === HUMAN_PLAYER,
    canDrawFromStock: state != null && state.phase === "draw" && state.currentPlayerId === HUMAN_PLAYER && state.stock.length > 0,
    canTakeDiscard: state != null && state.phase === "draw" && state.currentPlayerId === HUMAN_PLAYER && state.discard.length > 0,
    stockEmpty: state != null && state.stock.length === 0,
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
    myPlayerId: HUMAN_PLAYER,
    lastDrawnCard,
  };
}
