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
import { PICKUP_PENALTY } from "../constants";

const HUMAN_PLAYER: PlayerId = "p1";
const AI_PLAYER: PlayerId = "p2";
const AI_DRAW_DELAY_MS = 1000;
const AI_DISCARD_DELAY_MS = 600;

export function useGameState() {
  const [state, setState] = useState<GameState | null>(null);
  const [lastDrawnCard, setLastDrawnCard] = useState<Card | null>(null);
  const lastDrawnRef = useRef<Card | null>(null);
  const aiTurnRef = useRef(false);

  useEffect(() => {
    setState(createInitialState());
  }, []);

  // Auto-play AI turn i single player – samma flöde som att vänta på motståndare i multiplayer
  useEffect(() => {
    if (!state || state.phase === "roundEnd" || state.phase === "gameOver") return;
    if (state.currentPlayerId !== AI_PLAYER) return;
    if (aiTurnRef.current) return;

    if (state.phase === "draw") {
      aiTurnRef.current = true;
      const t = setTimeout(() => {
        setState((s) => {
          if (s == null || s.phase !== "draw" || s.currentPlayerId !== AI_PLAYER) return s;
          if (s.stock.length > 0) {
            const card = s.stock[s.stock.length - 1];
            return {
              ...s,
              stock: s.stock.slice(0, -1),
              playerHands: {
                ...s.playerHands,
                [AI_PLAYER]: sortHand([...s.playerHands[AI_PLAYER], card]),
              },
              phase: "meldOrDiscard",
              lastDraw: "stock",
            };
          }
          if (s.discard.length > 0) {
            const newHand = sortHand([...s.playerHands[AI_PLAYER], ...s.discard]);
            return {
              ...s,
              discard: [],
              playerHands: { ...s.playerHands, [AI_PLAYER]: newHand },
              phase: "meldOrDiscard",
              lastDraw: "discard",
            };
          }
          return { ...s, phase: "meldOrDiscard", lastDraw: null };
        });
        aiTurnRef.current = false;
      }, AI_DRAW_DELAY_MS);
      return () => clearTimeout(t);
    }

    if (state.phase === "meldOrDiscard") {
      aiTurnRef.current = true;
      const t = setTimeout(() => {
        setState((s) => {
          if (s == null || s.phase !== "meldOrDiscard" || s.currentPlayerId !== AI_PLAYER) return s;
          const hand = s.playerHands[AI_PLAYER];
          if (hand.length === 0) return s;
          const handIndex = Math.floor(Math.random() * hand.length);
          const cardToDiscard = hand[handIndex];
          const newHand = hand.filter((_, i) => i !== handIndex);
          const newDiscard = [cardToDiscard, ...s.discard];
          let updated: GameState = {
            ...s,
            discard: newDiscard,
            playerHands: { ...s.playerHands, [AI_PLAYER]: newHand },
          };
          if (s.lastDraw === "discard" && (s.cardsLaidThisTurn ?? 0) < 3) {
            updated = {
              ...updated,
              playerScores: {
                ...updated.playerScores,
                [AI_PLAYER]: (updated.playerScores[AI_PLAYER] ?? 0) - PICKUP_PENALTY,
              },
            };
          }
          if (newHand.length === 0) {
            const newScores = { ...updated.playerScores };
            for (const m of updated.melds) {
              if (m.ownerId === AI_PLAYER)
                newScores[AI_PLAYER] = (newScores[AI_PLAYER] ?? 0) + getMeldPoints(m.cards);
            }
            newScores[HUMAN_PLAYER] = (newScores[HUMAN_PLAYER] ?? 0) - getHandPenalty(updated.playerHands[HUMAN_PLAYER] ?? []);
            const gameWinner = checkGameOver(newScores);
            return {
              ...updated,
              playerScores: newScores,
              phase: gameWinner != null ? ("gameOver" as const) : ("roundEnd" as const),
              winnerId: gameWinner ?? AI_PLAYER,
            };
          }
          const gameWinner = checkGameOver(s.playerScores);
          const nextId = getNextPlayerId(updated.currentPlayerId!);
          const next = {
            ...updated,
            currentPlayerId: nextId,
            phase: "draw" as const,
            lastDraw: null,
          };
          return gameWinner != null ? { ...next, winnerId: gameWinner } : next;
        });
        aiTurnRef.current = false;
      }, AI_DISCARD_DELAY_MS);
      return () => clearTimeout(t);
    }
  }, [state?.phase, state?.currentPlayerId]);

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
      cardsLaidThisTurn: 0,
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
      let updated: GameState = {
        ...s,
        discard: newDiscard,
        playerHands: newPlayerHands,
      };
      if (s.lastDraw === "discard" && (s.cardsLaidThisTurn ?? 0) < 3) {
        updated = {
          ...updated,
          playerScores: {
            ...updated.playerScores,
            [HUMAN_PLAYER]: (updated.playerScores[HUMAN_PLAYER] ?? 0) - PICKUP_PENALTY,
          },
        };
      }
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
      if (s.stock.length === 0) return s;
      let next = s;
      if (s.lastDraw === "discard" && (s.cardsLaidThisTurn ?? 0) < 3) {
        next = {
          ...s,
          playerScores: {
            ...s.playerScores,
            [HUMAN_PLAYER]: (s.playerScores[HUMAN_PLAYER] ?? 0) - PICKUP_PENALTY,
          },
        };
      }
      return advanceTurn(next);
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
        cardsLaidThisTurn: (s.cardsLaidThisTurn ?? 0) + cards.length,
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
      // Kort läggs i ordning; 2:ans position bestäms av wildRepresents (visas i getMeldDisplayCards).
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
        cardsLaidThisTurn: (s.cardsLaidThisTurn ?? 0) + 1,
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
    canDraw: state != null && state.phase === "draw" && state.currentPlayerId === HUMAN_PLAYER,
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
