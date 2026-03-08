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
import { findFirstPossibleMeld } from "../ai-melds";
import { getHandPenalty, getMeldPointsByPlayer } from "../scoring";
import { PICKUP_PENALTY } from "../constants";

const HUMAN_PLAYER: PlayerId = "p1";
const AI_PLAYER: PlayerId = "p2";
const AI_DRAW_DELAY_MS = 1000;
const AI_DISCARD_DELAY_MS = 600;

export function useGameState() {
  const [state, setState] = useState<GameState | null>(null);
  const [lastDrawnCards, setLastDrawnCards] = useState<Card[]>([]);
  const lastDrawnRef = useRef<Card | Card[] | null>(null);
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
          let hand = s.playerHands[AI_PLAYER];
          let melds = s.melds;
          let cardsLaidThisTurn = s.cardsLaidThisTurn ?? 0;

          let aiLaidMeldId: string | null = null;
          const choice = findFirstPossibleMeld(hand);
          if (choice && choice.indices.length >= 3) {
            const indices = [...choice.indices].sort((a, b) => a - b);
            const cards = indices.map((i) => hand[i]);
            const type = getMeldType(cards);
            if (type) {
              aiLaidMeldId = crypto.randomUUID();
              hand = hand.filter((_, i) => !indices.includes(i));
              melds = [
                ...melds,
                {
                  id: aiLaidMeldId,
                  cards,
                  type,
                  ownerId: AI_PLAYER,
                  ...(Object.keys(choice.wildRepresents).length > 0
                    ? { wildRepresents: choice.wildRepresents }
                    : undefined),
                },
              ];
              cardsLaidThisTurn += cards.length;
            }
          }

          if (hand.length === 0) {
            const updated = {
              ...s,
              melds,
              cardsLaidThisTurn,
              playerHands: { ...s.playerHands, [AI_PLAYER]: hand },
              lastLaidMeldIds: aiLaidMeldId ? [aiLaidMeldId] : [],
            };
            if (s.lastDraw === "discard" && cardsLaidThisTurn < 3) {
              updated.playerScores = {
                ...updated.playerScores,
                [AI_PLAYER]: (updated.playerScores[AI_PLAYER] ?? 0) - PICKUP_PENALTY,
              };
            }
            const meldByPlayer = getMeldPointsByPlayer(updated.melds, getPlayerIds());
            const newScores = { ...updated.playerScores };
            newScores[AI_PLAYER] = (newScores[AI_PLAYER] ?? 0) + meldByPlayer[AI_PLAYER];
            newScores[HUMAN_PLAYER] = (newScores[HUMAN_PLAYER] ?? 0) + meldByPlayer[HUMAN_PLAYER] - getHandPenalty(updated.playerHands[HUMAN_PLAYER] ?? []);
            const gameWinner = checkGameOver(newScores);
            return {
              ...updated,
              playerScores: newScores,
              phase: gameWinner != null ? ("gameOver" as const) : ("roundEnd" as const),
              winnerId: gameWinner ?? AI_PLAYER,
              lastLaidMeldIds: [],
            };
          }
          const handIndex = Math.floor(Math.random() * hand.length);
          const cardToDiscard = hand[handIndex];
          const newHand = hand.filter((_, i) => i !== handIndex);
          const newDiscard = [cardToDiscard, ...s.discard];
          let updated: GameState = {
            ...s,
            melds,
            cardsLaidThisTurn,
            discard: newDiscard,
            playerHands: { ...s.playerHands, [AI_PLAYER]: newHand },
            lastLaidMeldIds: aiLaidMeldId ? [aiLaidMeldId] : [],
          };
          if (s.lastDraw === "discard" && cardsLaidThisTurn < 3) {
            updated = {
              ...updated,
              playerScores: {
                ...updated.playerScores,
                [AI_PLAYER]: (updated.playerScores[AI_PLAYER] ?? 0) - PICKUP_PENALTY,
              },
            };
          }
          if (newHand.length === 0) {
            const meldByPlayer = getMeldPointsByPlayer(updated.melds, getPlayerIds());
            const newScores = { ...updated.playerScores };
            newScores[AI_PLAYER] = (newScores[AI_PLAYER] ?? 0) + meldByPlayer[AI_PLAYER];
            newScores[HUMAN_PLAYER] = (newScores[HUMAN_PLAYER] ?? 0) + meldByPlayer[HUMAN_PLAYER] - getHandPenalty(updated.playerHands[HUMAN_PLAYER] ?? []);
            const gameWinner = checkGameOver(newScores);
            return {
              ...updated,
              playerScores: newScores,
              phase: gameWinner != null ? ("gameOver" as const) : ("roundEnd" as const),
              winnerId: gameWinner ?? AI_PLAYER,
              lastLaidMeldIds: [],
            };
          }
          const gameWinner = checkGameOver(s.playerScores);
          const nextId = getNextPlayerId(updated.currentPlayerId!);
          const next = {
            ...updated,
            currentPlayerId: nextId,
            phase: "draw" as const,
            lastDraw: null,
            lastLaidMeldIds: updated.lastLaidMeldIds ?? [],
          };
          return gameWinner != null ? { ...next, winnerId: gameWinner } : next;
        });
        aiTurnRef.current = false;
      }, AI_DISCARD_DELAY_MS);
      return () => clearTimeout(t);
    }
  }, [state?.phase, state?.currentPlayerId]);

  const flushLastDrawn = useCallback(() => {
    const v = lastDrawnRef.current;
    lastDrawnRef.current = null;
    setLastDrawnCards(Array.isArray(v) ? v : v ? [v] : []);
  }, []);

  const drawFromStock = useCallback(() => {
    setState((s) => {
      if (s == null) return s;
      if (s.phase !== "draw" || s.currentPlayerId !== HUMAN_PLAYER || s.stock.length === 0)
        return s;
      const card = s.stock[s.stock.length - 1];
      lastDrawnRef.current = card as Card;
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
      const newHand = [...s.playerHands[HUMAN_PLAYER], ...s.discard];
      lastDrawnRef.current = [...s.discard];
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
    setLastDrawnCards([]);
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
      lastLaidMeldIds: s.currentPlayerId === HUMAN_PLAYER ? [] : (s.lastLaidMeldIds ?? []),
    };
  }, []);

  const discardCard = useCallback((handIndex: number) => {
    lastDrawnRef.current = null;
    setLastDrawnCards([]);
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
        const ids = getPlayerIds();
        const meldByPlayer = getMeldPointsByPlayer(updated.melds, ids);
        const newScores = { ...updated.playerScores };
        newScores[HUMAN_PLAYER] = (newScores[HUMAN_PLAYER] ?? 0) + meldByPlayer[HUMAN_PLAYER];
        for (const id of ids) {
          if (id === HUMAN_PLAYER) continue;
          const penalty = getHandPenalty(updated.playerHands[id] ?? []);
          newScores[id] = (newScores[id] ?? 0) + meldByPlayer[id] - penalty;
        }
        const gameWinner = checkGameOver(newScores);
        return {
          ...updated,
          playerScores: newScores,
          phase: gameWinner != null ? ("gameOver" as const) : ("roundEnd" as const),
          winnerId: gameWinner ?? HUMAN_PLAYER,
          lastLaidMeldIds: [],
        };
      }
      const gameWinner = checkGameOver(s.playerScores);
      const next = advanceTurn(updated);
      return gameWinner != null ? { ...next, winnerId: gameWinner } : next;
    });
  }, [advanceTurn]);

  const passWithoutDiscard = useCallback(() => {
    lastDrawnRef.current = null;
    setLastDrawnCards([]);
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
    setLastDrawnCards([]);
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
      const newMelds = [...s.melds, newMeld];
      const next = {
        ...s,
        playerHands: { ...s.playerHands, [HUMAN_PLAYER]: newHand },
        melds: newMelds,
        cardsLaidThisTurn: (s.cardsLaidThisTurn ?? 0) + cards.length,
        lastLaidMeldIds: [newMeld.id],
      };
      if (newHand.length === 0) {
        const ids = getPlayerIds();
        const meldByPlayer = getMeldPointsByPlayer(next.melds, ids);
        const newScores = { ...next.playerScores };
        newScores[HUMAN_PLAYER] = (newScores[HUMAN_PLAYER] ?? 0) + meldByPlayer[HUMAN_PLAYER];
        for (const id of ids) {
          if (id === HUMAN_PLAYER) continue;
          const penalty = getHandPenalty(next.playerHands[id] ?? []);
          newScores[id] = (newScores[id] ?? 0) + meldByPlayer[id] - penalty;
        }
        const gameWinner = checkGameOver(newScores);
        return {
          ...next,
          playerScores: newScores,
          phase: gameWinner != null ? ("gameOver" as const) : ("roundEnd" as const),
          winnerId: gameWinner ?? HUMAN_PLAYER,
          lastLaidMeldIds: [],
        };
      }
      return next;
    });
  }, []);

  const addCardToExistingMeld = useCallback((meldId: string, handIndex: number, wildAs?: import("../types").Card) => {
    lastDrawnRef.current = null;
    setLastDrawnCards([]);
    setState((s) => {
      if (s == null) return s;
      if (s.phase !== "meldOrDiscard" || s.currentPlayerId !== HUMAN_PLAYER)
        return s;
      const hand = s.playerHands[HUMAN_PLAYER];
      if (handIndex < 0 || handIndex >= hand.length) return s;
      const meld = s.melds.find((m) => m.id === meldId);
      if (meld == null) return s;
      const isOpponentMeld = (meld.ownerId ?? HUMAN_PLAYER) !== HUMAN_PLAYER;
      if (isOpponentMeld && !s.melds.some((m) => m.ownerId === HUMAN_PLAYER))
        return s;
      const card = hand[handIndex];
      if (!canAddCardToMeld(card, meld)) return s;
      const newHand = hand.filter((_, i) => i !== handIndex);
      const newCards = [...meld.cards, card];
      const newIndex = newCards.length - 1;
      const newWildRepresents = wildAs && card.rank === "2"
        ? { ...meld.wildRepresents, [newIndex]: wildAs }
        : meld.wildRepresents;
      const newCardContributors = { ...meld.cardContributors, [newIndex]: HUMAN_PLAYER };
      const updatedMeld = { ...meld, cards: newCards, wildRepresents: newWildRepresents, cardContributors: newCardContributors };
      const newMelds = s.melds.map((m) =>
        m.id === meldId ? updatedMeld : m
      );
      const next = {
        ...s,
        playerHands: { ...s.playerHands, [HUMAN_PLAYER]: newHand },
        melds: newMelds,
        cardsLaidThisTurn: (s.cardsLaidThisTurn ?? 0) + 1,
        lastLaidMeldIds: [meldId],
      };
      if (newHand.length === 0) {
        const ids = getPlayerIds();
        const meldByPlayer = getMeldPointsByPlayer(next.melds, ids);
        const newScores = { ...next.playerScores };
        newScores[HUMAN_PLAYER] = (newScores[HUMAN_PLAYER] ?? 0) + meldByPlayer[HUMAN_PLAYER];
        for (const id of ids) {
          if (id === HUMAN_PLAYER) continue;
          const penalty = getHandPenalty(next.playerHands[id] ?? []);
          newScores[id] = (newScores[id] ?? 0) + meldByPlayer[id] - penalty;
        }
        const gameWinner = checkGameOver(newScores);
        return {
          ...next,
          playerScores: newScores,
          phase: gameWinner != null ? ("gameOver" as const) : ("roundEnd" as const),
          winnerId: gameWinner ?? HUMAN_PLAYER,
          lastLaidMeldIds: [],
        };
      }
      return next;
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
    setLastDrawnCards([]);
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
    loading: false,
    waitingForStart: false,
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
    lastDrawnCards,
    hasLaidFirstMeld: state != null && state.melds.some((m) => m.ownerId === HUMAN_PLAYER),
  };
}
