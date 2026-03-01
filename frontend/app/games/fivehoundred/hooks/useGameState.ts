"use client";

import { useState, useCallback, useEffect } from "react";
import type { Card, PlayerId } from "../types";
import type { GameState } from "../game-state";
import {
  createInitialState,
  getPlayerIds,
  getNextPlayerId,
  checkGameOver,
} from "../game-state";
import { sortHand } from "../deck";
import { getMeldType, canAddCardToMeld } from "../melds";

const HUMAN_PLAYER: PlayerId = "p1";

export function useGameState() {
  const [state, setState] = useState<GameState | null>(null);

  useEffect(() => {
    setState(createInitialState());
  }, []);

  const drawFromStock = useCallback(() => {
    setState((s) => {
      if (s == null) return s;
      if (s.phase !== "draw" || s.currentPlayerId !== HUMAN_PLAYER || s.stock.length === 0)
        return s;
      const card = s.stock[s.stock.length - 1];
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
  }, []);

  const takeDiscardPile = useCallback(() => {
    setState((s) => {
      if (s == null) return s;
      if (s.phase !== "draw" || s.currentPlayerId !== HUMAN_PLAYER || s.discard.length === 0)
        return s;
      const newHand = [...s.playerHands[HUMAN_PLAYER], ...s.discard];
      return {
        ...s,
        discard: [],
        playerHands: { ...s.playerHands, [HUMAN_PLAYER]: sortHand(newHand) },
        phase: "meldOrDiscard",
        lastDraw: "discard",
      };
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
      const winner = checkGameOver(s.playerScores);
      const next = advanceTurn(updated);
      return winner != null ? { ...next, winnerId: winner } : next;
    });
  }, [advanceTurn]);

  const passWithoutDiscard = useCallback(() => {
    setState((s) => {
      if (s == null) return s;
      if (s.phase !== "meldOrDiscard" || s.currentPlayerId !== HUMAN_PLAYER)
        return s;
      return advanceTurn(s);
    });
  }, [advanceTurn]);

  const addMeld = useCallback((cardIndices: number[]) => {
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
      };
      return {
        ...s,
        playerHands: { ...s.playerHands, [HUMAN_PLAYER]: newHand },
        melds: [...s.melds, newMeld],
      };
    });
  }, []);

  const addCardToExistingMeld = useCallback((meldId: string, handIndex: number) => {
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
      const newMelds = s.melds.map((m) =>
        m.id === meldId ? { ...m, cards: newCards } : m
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

  const humanHand = state?.playerHands[HUMAN_PLAYER] ?? [];
  const topDiscard = state && state.discard.length > 0 ? state.discard[0] : null;

  return {
    state,
    isReady: state != null,
    humanHand,
    topDiscard,
    isHumanTurn: state != null && state.phase !== "roundEnd" && state.currentPlayerId === HUMAN_PLAYER,
    canDraw: state != null && state.phase === "draw" && state.currentPlayerId === HUMAN_PLAYER,
    drawFromStock,
    takeDiscardPile,
    discardCard,
    passWithoutDiscard,
    addMeld,
    addCardToExistingMeld,
    advanceToNextTurn,
    resetGame,
    getPlayerIds,
    myPlayerId: HUMAN_PLAYER,
  };
}
