"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Card, PlayerId, Rank } from "../types";
import type { GameState } from "../game-state";
import {
  createInitialState,
  getPlayerIds,
  getNextPlayerId,
  getStickWinner,
} from "../game-state";
import { sortHand, sortHandForPlay } from "../deck";
import { RANK_VALUE } from "../types";

const HUMAN_PLAYER: PlayerId = "p1";

/** Kontrollera om kort bildar ett giltigt stege (samma färg, på varandra följande valörer). */
function isValidStege(cards: Card[]): boolean {
  if (cards.length < 2) return false;
  const suit = cards[0].suit;
  if (!cards.every((c) => c.suit === suit)) return false;
  const sorted = [...cards].sort((a, b) => RANK_VALUE[a.rank] - RANK_VALUE[b.rank]);
  for (let i = 1; i < sorted.length; i++) {
    if (RANK_VALUE[sorted[i].rank] !== RANK_VALUE[sorted[i - 1].rank] + 1) return false;
  }
  return true;
}

/** Kontrollera om kort bildar giltigt set (samma valör, 2–3 kort). */
function isValidSet(cards: Card[]): boolean {
  if (cards.length < 2 || cards.length > 3) return false;
  const rank = cards[0].rank;
  return cards.every((c) => c.rank === rank);
}

/** Hitta största spelbara ledkort (stegar/set 3→2→1). */
function findBestLead(hand: Card[]): { cards: Card[]; indices: number[] } {
  for (const len of [3, 2]) {
    for (let i = 0; i <= hand.length - len; i++) {
      const slice = hand.slice(i, i + len);
      if (isValidStege(slice)) {
        const indices = slice.map((c) => hand.indexOf(c));
        return { cards: slice, indices };
      }
    }
    const byRank = new Map<string, Card[]>();
    for (const c of hand) {
      const k = c.rank;
      if (!byRank.has(k)) byRank.set(k, []);
      byRank.get(k)!.push(c);
    }
    for (const [, cards] of byRank) {
      if (cards.length >= len) {
        const slice = cards.slice(0, len);
        const indices = slice.map((c) => hand.indexOf(c));
        return { cards: slice, indices };
      }
    }
  }
  const i = Math.floor(Math.random() * hand.length);
  return { cards: [hand[i]], indices: [i] };
}

/** Högsta valör i en uppsättning kort. */
function highestRank(cards: Card[]): Rank {
  return cards.reduce((best, c) =>
    RANK_VALUE[c.rank] > RANK_VALUE[best] ? c.rank : best
  , cards[0].rank);
}

/** Kontrollera om stege/set slår ledet (färg/trumf + valör). */
function isMultiLegalToPlay(s: GameState, cards: Card[]): boolean {
  const leadSuit = s.trickLeadSuit!;
  const toBeat = s.trickHighRank!;
  const trumpSuit = s.trumpSuit;
  const tableTrick = s.tableTrick ?? [];
  const highestTrump = tableTrick
    .filter((tc) => tc.card.suit === trumpSuit)
    .reduce<Rank | null>((b, tc) =>
      !b || RANK_VALUE[tc.card.rank] > RANK_VALUE[b] ? tc.card.rank : b
    , null);
  const myHigh = highestRank(cards);
  const myTrumps = cards.filter((c) => c.suit === trumpSuit);
  const myLeadSuit = cards.filter((c) => c.suit === leadSuit);
  if (myTrumps.length > 0 && leadSuit !== trumpSuit) return true;
  if (myTrumps.length > 0 && leadSuit === trumpSuit)
    return !highestTrump || RANK_VALUE[myHigh] > RANK_VALUE[highestTrump];
  if (myLeadSuit.length > 0) return RANK_VALUE[myHigh] > RANK_VALUE[toBeat];
  return false;
}

const LOW_RANKS: Rank[] = ["2", "3", "4", "5"];

/** Skitgubbe-regeln: spelare med bara kort under trumfkortets valör får 2–5 från alla + trumf 6 */
function applySkitgubbeRule(
  s: GameState
): { hands: Record<PlayerId, Card[]>; skitgubbeId: PlayerId | null } {
  const trumpRank = s.lastRevealedCard?.rank;
  const trumpSuit = s.trumpSuit;
  if (!trumpRank || !trumpSuit) return { hands: s.playerHands, skitgubbeId: null };

  const trumpVal = RANK_VALUE[trumpRank];
  let skitgubbe: PlayerId | null = null;

  for (const id of s.playerIds) {
    const hand = s.playerHands[id] ?? [];
    const allBelow = hand.every((c) => RANK_VALUE[c.rank] < trumpVal);
    if (allBelow && hand.length > 0) {
      skitgubbe = id;
      break;
    }
  }

  if (!skitgubbe) return { hands: s.playerHands, skitgubbeId: null };

  const penaltyCards: Card[] = [];
  const newHands = { ...s.playerHands };

  for (const id of s.playerIds) {
    if (id === skitgubbe) continue;
    const hand = newHands[id] ?? [];
    const toGive = hand.filter(
      (c) => LOW_RANKS.includes(c.rank) || (c.suit === trumpSuit && c.rank === "6")
    );
    for (const c of toGive) penaltyCards.push(c);
    newHands[id] = hand.filter(
      (c) => !LOW_RANKS.includes(c.rank) && !(c.suit === trumpSuit && c.rank === "6")
    );
  }

  newHands[skitgubbe] = sortHand([
    ...(newHands[skitgubbe] ?? []),
    ...penaltyCards,
  ]);

  return { hands: newHands, skitgubbeId: skitgubbe };
}

export function useSkitgubbeGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [selectedTrickIndices, setSelectedTrickIndices] = useState<Set<number>>(new Set());
  const aiTurnRef = useRef(false);

  const humanHand = state?.playerHands[HUMAN_PLAYER] ?? [];
  const isHumanTurn = state?.currentPlayerId === HUMAN_PLAYER;

  const playableStickIndices = (() => {
    if (!state || state.phase !== "sticks" || !isHumanTurn || state.stickShowingWinner) return new Set<number>();
    const hand = state.playerHands[HUMAN_PLAYER] ?? [];
    if (hand.length === 0) return new Set<number>();
    if (state.stickLedRank !== null) {
      if (state.playersMustPlay.includes(HUMAN_PLAYER)) {
        return new Set(hand.map((c, i) => (c.rank === state.stickLedRank ? i : -1)).filter((i) => i >= 0));
      }
      if (state.stickFighters.includes(HUMAN_PLAYER) && state.tableStick.some((sc) => sc.playerId === HUMAN_PLAYER)) {
        return new Set(hand.map((_, i) => i));
      }
    }
    return new Set(hand.map((_, i) => i));
  })();

  const playableTrickIndices = (() => {
    if (!state || state.phase !== "play" || !isHumanTurn) return new Set<number>();
    const hand = state.playerHands[HUMAN_PLAYER] ?? [];
    if (hand.length === 0) return new Set<number>();
    if (state.trickLeadSuit === null) return new Set(hand.map((_, i) => i));

    const leadCount = state.tableTrick?.filter((tc) => tc.playerId === state.trickLeader).length ?? 1;
    if (leadCount > 1) return new Set(hand.map((_, i) => i));

    const toBeat = state.trickHighRank ?? null;
    const leadSuit = state.trickLeadSuit;
    const trumpSuit = state.trumpSuit;
    const tableTrick = state.tableTrick ?? [];

    const leadSuitCards = hand.filter((c) => c.suit === leadSuit);
    const trumpCards = hand.filter((c) => c.suit === trumpSuit);

    const highestTrumpOnTable = tableTrick
      .filter((tc) => tc.card.suit === trumpSuit)
      .reduce<Rank | null>((best, tc) => {
        if (!best) return tc.card.rank;
        return RANK_VALUE[tc.card.rank] > RANK_VALUE[best] ? tc.card.rank : best;
      }, null);

    if (leadSuitCards.length > 0) {
      const canBeat = toBeat
        ? leadSuitCards.filter((c) => RANK_VALUE[c.rank] > RANK_VALUE[toBeat])
        : leadSuitCards;
      if (canBeat.length > 0) {
        return new Set(canBeat.map((c) => hand.indexOf(c)));
      }
    }

    if (trumpCards.length > 0) {
      const canBeatWithTrump = highestTrumpOnTable
        ? trumpCards.filter((c) => RANK_VALUE[c.rank] > RANK_VALUE[highestTrumpOnTable])
        : trumpCards;
      if (canBeatWithTrump.length > 0) {
        return new Set(canBeatWithTrump.map((c) => hand.indexOf(c)));
      }
    }

    return new Set<number>();
  })();

  const canPickUpTrick =
    state?.phase === "play" &&
    isHumanTurn &&
    !state?.trickShowingWinner &&
    (state?.tableTrick?.length ?? 0) > 0;

  const toggleTrickSelection = useCallback((handIndex: number) => {
    setSelectedTrickIndices((prev) => {
      const next = new Set(prev);
      if (next.has(handIndex)) next.delete(handIndex);
      else next.add(handIndex);
      return next;
    });
  }, []);

  const clearTrickSelection = useCallback(() => {
    setSelectedTrickIndices(new Set());
  }, []);

  const isTrickSelectionValid = (() => {
    if (!state || state.phase !== "play" || !isHumanTurn || state.trickShowingWinner || selectedTrickIndices.size === 0)
      return false;
    const hand = state.playerHands[HUMAN_PLAYER] ?? [];
    const cards = [...selectedTrickIndices].map((i) => hand[i]).filter(Boolean);
    if (cards.length !== selectedTrickIndices.size) return false;
    if (state.trickLeadSuit === null) {
      if (cards.length === 1) return true;
      return isValidStege(cards) || isValidSet(cards);
    }
    const leadCount = state.tableTrick?.filter((tc) => tc.playerId === state.trickLeader).length ?? 1;
    const leadSuit = state.trickLeadSuit;
    if (leadCount === 1) {
      return playableTrickIndices.has([...selectedTrickIndices][0]);
    }
    // Vid flerkortsutspel: samma antal KORTELLER kortare stege i samma färg som slår
    if (cards.length > leadCount) return false;
    if (cards.length === leadCount) {
      return (isValidStege(cards) || isValidSet(cards)) && isMultiLegalToPlay(state, cards);
    }
    // Kortare stege: giltigt om samma färg som ledet och högsta kortet slår
    if (leadSuit && isValidStege(cards) && cards.every((c) => c.suit === leadSuit)) {
      const toBeat = state.trickHighRank;
      if (toBeat && RANK_VALUE[highestRank(cards)] > RANK_VALUE[toBeat]) return true;
    }
    // Trumf eller set med samma antal
    return (isValidStege(cards) || isValidSet(cards)) && isMultiLegalToPlay(state, cards);
  })();

  const confirmTrickPlay = useCallback(() => {
    if (!isTrickSelectionValid) return;
    setState((s) => {
      if (!s || s.phase !== "play" || s.currentPlayerId !== HUMAN_PLAYER) return s;
      const hand = s.playerHands[HUMAN_PLAYER];
      const indices = [...selectedTrickIndices].sort((a, b) => a - b);
      const cards = indices.map((i) => hand[i]);
      return applyTrickCards(s, HUMAN_PLAYER, cards, indices);
    });
    setSelectedTrickIndices(new Set());
  }, [isTrickSelectionValid, selectedTrickIndices]);

  const startGame = useCallback((count: number) => {
    setPlayerCount(count);
    setState(createInitialState(count));
  }, []);

  const playCardFromHand = useCallback((handIndex: number) => {
    setState((s) => {
      if (!s || s.phase !== "sticks" || s.currentPlayerId !== HUMAN_PLAYER || s.stickShowingWinner) return s;
      const hand = s.playerHands[HUMAN_PLAYER];
      if (handIndex < 0 || handIndex >= hand.length) return s;
      const card = hand[handIndex];
      if (s.stickLedRank !== null && s.playersMustPlay.includes(HUMAN_PLAYER) && card.rank !== s.stickLedRank)
        return s;
      return applyPlayCard(s, HUMAN_PLAYER, card, handIndex);
    });
  }, []);

  const drawAndPlay = useCallback(() => {
    setState((s) => {
      if (!s || s.phase !== "sticks" || s.currentPlayerId !== HUMAN_PLAYER || s.stickShowingWinner) return s;
      if (s.stock.length === 0) return s;
      const card = s.stock[s.stock.length - 1];
      const newStock = s.stock.slice(0, -1);
      return applyPlayCard(s, HUMAN_PLAYER, card, -1, newStock);
    });
  }, []);

  const continueToPlay = useCallback(() => {
    setState((s) => {
      if (!s || s.phase !== "skitgubbe") return s;
      const handsWithWonCards: Record<PlayerId, Card[]> = {};
      for (const id of s.playerIds) {
        const hand = s.playerHands[id] ?? [];
        const won = s.wonCards?.[id] ?? [];
        handsWithWonCards[id] = [...hand, ...won];
      }
      const stateWithMergedHands = { ...s, playerHands: handsWithWonCards };
      const { hands, skitgubbeId } = applySkitgubbeRule(stateWithMergedHands);
      const sortedHands: Record<string, Card[]> = {};
      for (const id of Object.keys(hands) as PlayerId[]) {
        sortedHands[id] = sortHandForPlay(hands[id] ?? [], s.trumpSuit);
      }
      return {
        ...s,
        playerHands: sortedHands as Record<PlayerId, Card[]>,
        skitgubbePlayerId: skitgubbeId,
        phase: "play",
        tableTrick: [],
        trickLeader: s.lastStickWinner,
        trickLeadSuit: null,
        trickHighRank: null,
        trickShowingWinner: null,
        currentPlayerId: s.lastStickWinner ?? s.playerIds[0],
      };
    });
  }, []);

  const pickUpTrick = useCallback(() => {
    setState((s) => {
      if (!s || s.phase !== "play" || s.currentPlayerId !== HUMAN_PLAYER) return s;
      return applyPickUpTrick(s, HUMAN_PLAYER);
    });
  }, []);

  const playTrickCard = useCallback(
    (handIndex: number) => {
      if (state?.phase === "play" && isHumanTurn) {
        toggleTrickSelection(handIndex);
      }
    },
    [state?.phase, isHumanTurn, toggleTrickSelection]
  );

  const resetGame = useCallback(() => {
    setPlayerCount(null);
    setState(null);
  }, []);

  useEffect(() => {
    if (!state || state.phase !== "sticks" || !state.stickShowingWinner) return;
    const t = setTimeout(() => {
      setState((s) => {
        if (!s || s.phase !== "sticks" || !s.stickShowingWinner) return s;
        const w = s.stickShowingWinner;
        const cards = s.tableStick.map((sc) => sc.card);
        const sticksWon = { ...s.sticksWon, [w]: (s.sticksWon[w] ?? 0) + 1 };
        const wonCards = {
          ...(s.wonCards ?? Object.fromEntries(s.playerIds.map((id) => [id, [] as Card[]]))),
          [w]: [...(s.wonCards?.[w] ?? []), ...cards],
        };
        let drawStock = [...s.stock];
        let lastRevealed = s.lastRevealedCard;
        let trumpSuit = s.trumpSuit;
        let lastStickWinner = s.lastStickWinner;
        const drawOrder = getDrawOrder(s.playerIds, w);
        let newHands = { ...s.playerHands };
        for (const id of drawOrder) {
          while (drawStock.length > 0 && (newHands[id]?.length ?? 0) < 3) {
            const c = drawStock.pop()!;
            if (drawStock.length === 0) {
              lastRevealed = c;
              trumpSuit = c.suit;
              lastStickWinner = id;
            } else {
              newHands = { ...newHands, [id]: sortHand([...(newHands[id] ?? []), c]) };
            }
          }
        }
        if (drawStock.length === 1) {
          lastRevealed = drawStock[0];
          trumpSuit = lastRevealed.suit;
          lastStickWinner = w;
          drawStock = [];
        }
        // Säkerställ att trumf alltid sätts från sista kortet när leken är tom
        if (drawStock.length === 0 && lastRevealed && !trumpSuit) {
          trumpSuit = lastRevealed.suit;
        }
        const phase: GameState["phase"] = drawStock.length === 0 ? "skitgubbe" : "sticks";
        const finalHands =
          phase === "skitgubbe" && lastRevealed && lastStickWinner
            ? {
                ...newHands,
                [lastStickWinner]: sortHand([
                  ...(newHands[lastStickWinner] ?? []),
                  lastRevealed,
                ]),
              }
            : newHands;
        return {
          ...s,
          stock: drawStock,
          playerHands: finalHands,
          tableStick: [],
          stickLedRank: null,
          playersMustPlay: [],
          stickFighters: [],
          sticksWon,
          wonCards,
          stickShowingWinner: null,
          lastRevealedCard: lastRevealed,
          trumpSuit,
          lastStickWinner,
          phase,
        };
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [state?.stickShowingWinner]);

  useEffect(() => {
    if (!state || state.phase !== "sticks" || state.stickShowingWinner) return;
    if (state.currentPlayerId === HUMAN_PLAYER) return;
    if (aiTurnRef.current) return;

    aiTurnRef.current = true;
    const t = setTimeout(() => {
      setState((s) => {
        if (!s || s.phase !== "sticks" || s.currentPlayerId === HUMAN_PLAYER) return s;
        const aiId = s.currentPlayerId;
        const hand = s.playerHands[aiId] ?? [];

        let card: Card | null = null;
        let handIndex = -1;

        if (s.stickLedRank !== null) {
          if (s.playersMustPlay.includes(aiId)) {
            const idx = hand.findIndex((c) => c.rank === s.stickLedRank);
            if (idx >= 0) {
              card = hand[idx];
              handIndex = idx;
            }
          } else if (s.stickFighters.includes(aiId)) {
            const playedByAi = s.tableStick.filter((sc) => sc.playerId === aiId).length;
            if (playedByAi === 1 && hand.length > 0) {
              const idx = Math.floor(Math.random() * hand.length);
              card = hand[idx];
              handIndex = idx;
            }
          }
        }

        if (!card && hand.length > 0) {
          const idx = Math.floor(Math.random() * hand.length);
          card = hand[idx];
          handIndex = idx;
        }

        if (!card) {
          if (s.stock.length > 0) {
            card = s.stock[s.stock.length - 1];
            const newStock = s.stock.slice(0, -1);
            return applyPlayCard(s, aiId, card, -1, newStock);
          }
          return s;
        }

        return applyPlayCard(s, aiId, card, handIndex);
      });
      aiTurnRef.current = false;
    }, 700);
    return () => clearTimeout(t);
  }, [state?.phase, state?.currentPlayerId, state?.tableStick?.length]);

  useEffect(() => {
    if (!state || state.phase !== "play" || !state.trickShowingWinner) return;
    const t = setTimeout(() => {
      setState((s) => {
        if (!s || s.phase !== "play" || !s.trickShowingWinner) return s;
        return {
          ...s,
          tableTrick: [],
          trickShowingWinner: null,
        };
      });
    }, 2000);
    return () => clearTimeout(t);
  }, [state?.phase, state?.trickShowingWinner]);

  useEffect(() => {
    if (!state || state.phase !== "play" || state.trickShowingWinner) return;
    if (state.currentPlayerId === HUMAN_PLAYER) return;
    if (aiTurnRef.current) return;

    aiTurnRef.current = true;
    const t = setTimeout(() => {
      setState((s) => {
        if (!s || s.phase !== "play" || s.currentPlayerId === HUMAN_PLAYER) return s;
        const aiId = s.currentPlayerId;
        const hand = s.playerHands[aiId] ?? [];
        if (hand.length === 0) return s;

        const toBeat = s.trickHighRank;
        const leadSuit = s.trickLeadSuit;
        const tableTrick = s.tableTrick ?? [];
        const highestTrump = tableTrick
          .filter((tc) => tc.card.suit === s.trumpSuit)
          .reduce<Rank | null>((b, tc) =>
            !b || RANK_VALUE[tc.card.rank] > RANK_VALUE[b] ? tc.card.rank : b
          , null);

        if (leadSuit !== null) {
          const leadCount = tableTrick.filter((tc) => tc.playerId === s.trickLeader).length;
          if (leadCount > 1) {
            // Försök matcha med samma antal, sedan kortare stege (t.ex. J-Q mot 5-6-7)
            for (let len = Math.min(3, leadCount, hand.length); len >= 1; len--) {
              for (let start = 0; start <= hand.length - len; start++) {
                const slice = hand.slice(start, start + len);
                if ((isValidStege(slice) || isValidSet(slice)) && isMultiLegalToPlay(s, slice)) {
                  const indices = slice.map((c) => hand.indexOf(c));
                  return applyTrickCards(s, aiId, slice, indices);
                }
              }
              const byRank = new Map<string, Card[]>();
              for (const c of hand) {
                const k = c.rank;
                if (!byRank.has(k)) byRank.set(k, []);
                byRank.get(k)!.push(c);
              }
              for (const [, cards] of byRank) {
                if (cards.length >= len) {
                  const slice = cards.slice(0, len);
                  if (isMultiLegalToPlay(s, slice)) {
                    const indices = slice.map((c) => hand.indexOf(c));
                    return applyTrickCards(s, aiId, slice, indices);
                  }
                }
              }
            }
            return applyPickUpTrick(s, aiId);
          }
          const leadSuitCards = hand.filter((c) => c.suit === leadSuit);
          const trumpCards = hand.filter((c) => c.suit === s.trumpSuit);
          let playIndex = -1;
          if (leadSuitCards.length > 0) {
            const canBeat = toBeat
              ? leadSuitCards.filter((c) => RANK_VALUE[c.rank] > RANK_VALUE[toBeat])
              : leadSuitCards;
            if (canBeat.length > 0) {
              const best = canBeat.reduce((a, b) =>
                RANK_VALUE[a.rank] > RANK_VALUE[b.rank] ? a : b
              );
              playIndex = hand.indexOf(best);
            }
          }
          if (playIndex < 0 && trumpCards.length > 0) {
            const canBeatTrump = highestTrump
              ? trumpCards.filter((c) => RANK_VALUE[c.rank] > RANK_VALUE[highestTrump])
              : trumpCards;
            if (canBeatTrump.length > 0) {
              const best = canBeatTrump.reduce((a, b) =>
                RANK_VALUE[a.rank] > RANK_VALUE[b.rank] ? a : b
              );
              playIndex = hand.indexOf(best);
            }
          }
          if (playIndex < 0) return applyPickUpTrick(s, aiId);
          return applyTrickCard(s, aiId, hand[playIndex], playIndex);
        }

        const bestLead = findBestLead(hand);
        return applyTrickCards(s, aiId, bestLead.cards, bestLead.indices);
      });
      aiTurnRef.current = false;
    }, 2000);
    return () => clearTimeout(t);
  }, [state?.phase, state?.currentPlayerId, state?.tableTrick?.length]);

  useEffect(() => {
    if (state?.phase !== "play" || !isHumanTurn) {
      setSelectedTrickIndices(new Set());
    }
  }, [state?.phase, isHumanTurn]);

  return {
    state,
    playerCount,
    humanHand,
    isHumanTurn,
    playableStickIndices,
    playableTrickIndices,
    selectedTrickIndices,
    toggleTrickSelection,
    clearTrickSelection,
    isTrickSelectionValid,
    confirmTrickPlay,
    canDrawAndPlay: state?.phase === "sticks" && isHumanTurn && !state?.stickShowingWinner && (state?.stock.length ?? 0) > 0,
    canPickUpTrick,
    startGame,
    playCardFromHand,
    drawAndPlay,
    continueToPlay,
    playTrickCard,
    pickUpTrick,
    resetGame,
    getPlayerIds: () => (state ? getPlayerIds(state) : []),
    getSkitgubbePreview: () =>
      state?.phase === "skitgubbe" ? getSkitgubbePlayerId(state) : null,
  };
}

function getSkitgubbePlayerId(s: GameState): PlayerId | null {
  const trumpRank = s.lastRevealedCard?.rank;
  if (!trumpRank) return null;
  const trumpVal = RANK_VALUE[trumpRank];
  for (const id of s.playerIds) {
    const hand = s.playerHands[id] ?? [];
    if (hand.length > 0 && hand.every((c) => RANK_VALUE[c.rank] < trumpVal)) return id;
  }
  return null;
}

function applyTrickCards(
  s: GameState,
  playerId: PlayerId,
  cards: Card[],
  handIndices: number[]
): GameState {
  const indexSet = new Set(handIndices);
  const hand = s.playerHands[playerId].filter((_, i) => !indexSet.has(i));
  const newHands = { ...s.playerHands, [playerId]: sortHandForPlay(hand, s.trumpSuit) };
  const newTrickCards = cards.map((card) => ({ playerId, card }));
  const tableTrick = [...s.tableTrick, ...newTrickCards];

  if (hand.length === 0) {
    return {
      ...s,
      playerHands: newHands,
      tableTrick: [],
      trickLeader: null,
      trickLeadSuit: null,
      trickHighRank: null,
      phase: "gameOver",
      winnerId: playerId,
    };
  }

  const allPlayed = s.playerIds.every((id) => tableTrick.some((tc) => tc.playerId === id));
  if (!allPlayed) {
    const leadSuit = tableTrick[0].card.suit;
    const trumpOnTable = tableTrick.filter((tc) => tc.card.suit === s.trumpSuit);
    let effectiveSuit: Card["suit"];
    let highRank: Rank;

    if (trumpOnTable.length > 0) {
      effectiveSuit = s.trumpSuit!;
      highRank = trumpOnTable.reduce<Rank>(
        (best, tc) =>
          RANK_VALUE[tc.card.rank] > RANK_VALUE[best] ? tc.card.rank : best,
        trumpOnTable[0].card.rank
      );
    } else {
      effectiveSuit = leadSuit;
      const leadSuitCards = tableTrick.filter((tc) => tc.card.suit === leadSuit);
      highRank = leadSuitCards.reduce<Rank>(
        (best, tc) =>
          RANK_VALUE[tc.card.rank] > RANK_VALUE[best] ? tc.card.rank : best,
        leadSuitCards[0].card.rank
      );
    }

    const nextPlayer = getNextInOrder(s.playerIds, playerId);
    return {
      ...s,
      playerHands: newHands,
      tableTrick,
      trickLeader: s.trickLeader,
      trickLeadSuit: effectiveSuit,
      trickHighRank: highRank,
      currentPlayerId: nextPlayer,
    };
  }

  const leadSuit = tableTrick[0].card.suit;
  let trickWinner = tableTrick[0].playerId;
  let bestCard = tableTrick[0].card;
  for (const tc of tableTrick) {
    if (tc.card.suit === s.trumpSuit && bestCard.suit !== s.trumpSuit) {
      trickWinner = tc.playerId;
      bestCard = tc.card;
    } else if (tc.card.suit === s.trumpSuit && bestCard.suit === s.trumpSuit) {
      if (RANK_VALUE[tc.card.rank] > RANK_VALUE[bestCard.rank]) {
        trickWinner = tc.playerId;
        bestCard = tc.card;
      }
    } else if (tc.card.suit === leadSuit && bestCard.suit !== s.trumpSuit) {
      if (RANK_VALUE[tc.card.rank] > RANK_VALUE[bestCard.rank]) {
        trickWinner = tc.playerId;
        bestCard = tc.card;
      }
    }
  }

  return {
    ...s,
    playerHands: newHands,
    tableTrick,
    trickLeader: trickWinner,
    trickLeadSuit: null,
    trickHighRank: null,
    currentPlayerId: trickWinner,
    trickShowingWinner: trickWinner,
  };
}

function applyTrickCard(
  s: GameState,
  playerId: PlayerId,
  card: Card,
  handIndex: number
): GameState {
  return applyTrickCards(s, playerId, [card], [handIndex]);
}

function getNextInOrder(playerIds: PlayerId[], current: PlayerId): PlayerId {
  const i = playerIds.indexOf(current);
  return playerIds[(i + 1) % playerIds.length];
}

/** Compute suit and rank to beat from trick cards (trumf beats, else highest in lead suit). */
function getToBeatFromTrick(
  trick: { playerId: PlayerId; card: Card }[],
  trumpSuit: Card["suit"] | null
): { leaderId: PlayerId; effectiveSuit: Card["suit"]; highRank: Rank } | null {
  if (trick.length === 0) return null;
  const leadSuit = trick[0].card.suit;
  const trumpOnTable = trick.filter((tc) => tc.card.suit === trumpSuit);
  let bestPlayer = trick[0].playerId;
  let bestCard = trick[0].card;
  for (const tc of trick) {
    if (tc.card.suit === trumpSuit && bestCard.suit !== trumpSuit) {
      bestPlayer = tc.playerId;
      bestCard = tc.card;
    } else if (tc.card.suit === trumpSuit && bestCard.suit === trumpSuit) {
      if (RANK_VALUE[tc.card.rank] > RANK_VALUE[bestCard.rank]) {
        bestPlayer = tc.playerId;
        bestCard = tc.card;
      }
    } else if (tc.card.suit === leadSuit && bestCard.suit !== trumpSuit) {
      if (RANK_VALUE[tc.card.rank] > RANK_VALUE[bestCard.rank]) {
        bestPlayer = tc.playerId;
        bestCard = tc.card;
      }
    }
  }
  const effectiveSuit = trumpOnTable.length > 0 ? trumpSuit! : leadSuit;
  const leadSuitCards = trick.filter((tc) => tc.card.suit === effectiveSuit);
  const highRank = leadSuitCards.reduce<Rank>(
    (best, tc) =>
      RANK_VALUE[tc.card.rank] > RANK_VALUE[best] ? tc.card.rank : best,
    leadSuitCards[0].card.rank
  );
  return { leaderId: bestPlayer, effectiveSuit, highRank };
}

/** Pick up only the leader's cards; rest stays on table; turn to next player. */
function applyPickUpTrick(s: GameState, playerId: PlayerId): GameState {
  const tableTrick = s.tableTrick ?? [];
  const leader = s.trickLeader;
  if (tableTrick.length === 0 || !leader) return s;

  const leadersCards = tableTrick.filter((tc) => tc.playerId === leader);
  const remaining = tableTrick.filter((tc) => tc.playerId !== leader);
  const pickedUp = leadersCards.map((tc) => tc.card);
  const currentHand = s.playerHands[playerId] ?? [];
  const newHand = sortHandForPlay([...currentHand, ...pickedUp], s.trumpSuit);
  const nextPlayer = getNextInOrder(s.playerIds, playerId);

  if (remaining.length === 0) {
    return {
      ...s,
      playerHands: { ...s.playerHands, [playerId]: newHand },
      tableTrick: [],
      trickLeader: null,
      trickLeadSuit: null,
      trickHighRank: null,
      currentPlayerId: nextPlayer,
    };
  }

  const toBeat = getToBeatFromTrick(remaining, s.trumpSuit);
  if (!toBeat) return s;
  return {
    ...s,
    playerHands: { ...s.playerHands, [playerId]: newHand },
    tableTrick: remaining,
    trickLeader: toBeat.leaderId,
    trickLeadSuit: toBeat.effectiveSuit,
    trickHighRank: toBeat.highRank,
    currentPlayerId: nextPlayer,
  };
}

function applyPlayCard(
  s: GameState,
  playerId: PlayerId,
  card: Card,
  handIndex: number,
  newStock?: Card[]
): GameState {
  const stock = newStock ?? s.stock;
  let hands = { ...s.playerHands };

  if (handIndex >= 0) {
    const hand = hands[playerId].filter((_, i) => i !== handIndex);
    hands = { ...hands, [playerId]: sortHand(hand) };
  }

  const tableStick = [...s.tableStick, { playerId, card }];
  const isFighterPlaying = s.stickFighters.includes(playerId);
  const ledRank = isFighterPlaying ? card.rank : (s.stickLedRank ?? card.rank);
  const playersMustPlay = s.playersMustPlay.filter((id) => id !== playerId);

  const othersWithRank = isFighterPlaying
    ? s.stickFighters.filter(
        (id) => id !== playerId && hands[id]?.some((c) => c.rank === ledRank)
      )
    : s.playerIds.filter(
        (id) =>
          id !== playerId &&
          hands[id]?.some((c) => c.rank === ledRank) &&
          !tableStick.some((sc) => sc.playerId === id)
      );

  const allWithRankPlayed =
    playersMustPlay.length === 0 &&
    s.playerIds.every((id) => {
      if (hands[id]?.some((c) => c.rank === ledRank)) {
        return tableStick.some((sc) => sc.playerId === id);
      }
      return true;
    });

  const playersWhoHaventPlayed = s.playerIds.filter(
    (id) => !tableStick.some((sc) => sc.playerId === id)
  );

  // Original led rank from first card – must use this for fight detection
  const originalLedRank = tableStick.length > 0 ? tableStick[0].card.rank : ledRank;
  const fightersFromTable = [...new Set(
    tableStick.filter((sc) => sc.card.rank === originalLedRank).map((sc) => sc.playerId)
  )];

  const doDrawForHuman = () => {
    if (playerId === HUMAN_PLAYER && handIndex >= 0 && stock.length > 0) {
      const c = stock[stock.length - 1];
      return {
        finalStock: stock.slice(0, -1),
        finalHands: {
          ...hands,
          [HUMAN_PLAYER]: sortHand([...(hands[HUMAN_PLAYER] ?? []), c]),
        },
      };
    }
    return { finalStock: stock, finalHands: hands };
  };

  if (!allWithRankPlayed && othersWithRank.length > 0) {
    const { finalStock, finalHands } = doDrawForHuman();
    return {
      ...s,
      stock: finalStock,
      playerHands: finalHands,
      tableStick,
      stickLedRank: ledRank,
      playersMustPlay: [...playersMustPlay, ...othersWithRank],
      stickFighters: isFighterPlaying ? s.stickFighters : [],
      currentPlayerId: othersWithRank[0],
      humanPendingKlar: false,
      nextPlayerIdAfterKlar: null,
    };
  }

  const someonePlayedHigher =
    originalLedRank &&
    tableStick.some((sc) => RANK_VALUE[sc.card.rank] > RANK_VALUE[originalLedRank]);

  // Fight: första fightkortet blir ny led – ge andra fighten tur (behåll stickFighters)
  if (
    isFighterPlaying &&
    s.stickFighters.length > 1 &&
    othersWithRank.length === 0
  ) {
    const otherFighter = s.stickFighters.find(
      (id) =>
        id !== playerId &&
        tableStick.filter((sc) => sc.playerId === id).length === 1
    );
    if (otherFighter) {
      const { finalStock, finalHands } = doDrawForHuman();
      return {
        ...s,
        stock: finalStock,
        playerHands: finalHands,
        tableStick,
        stickLedRank: ledRank,
        playersMustPlay: [],
        stickFighters: s.stickFighters,
        currentPlayerId: otherFighter,
        humanPendingKlar: false,
        nextPlayerIdAfterKlar: null,
      };
    }
  }

  // When everyone has played and 2+ have the lead rank → fight continues
  // (båda måste spela fightkort – första sätter ny led, vi jämför bara fightkorten)
  if (
    playersWhoHaventPlayed.length === 0 &&
    fightersFromTable.length > 1 &&
    !someonePlayedHigher
  ) {
    const allFightersPlayed = fightersFromTable.every((fid) => {
      const cards = tableStick.filter((sc) => sc.playerId === fid);
      if (cards.length < 2) return false;
      const lastCard = cards[cards.length - 1];
      return lastCard.card.rank !== originalLedRank;
    });
    if (!allFightersPlayed) {
      const needsFightCard = (fid: PlayerId) => {
        const cards = tableStick.filter((sc) => sc.playerId === fid);
        return cards.length >= 1 && cards[cards.length - 1].card.rank === originalLedRank;
      };
      const nextFighter =
        fightersFromTable.find(needsFightCard) ??
        fightersFromTable.reduce((a, b) =>
          tableStick.findIndex((sc) => sc.playerId === a && sc.card.rank === originalLedRank) <
          tableStick.findIndex((sc) => sc.playerId === b && sc.card.rank === originalLedRank)
            ? a
            : b
        );
      if (nextFighter) {
        const { finalStock, finalHands } = doDrawForHuman();
        return {
          ...s,
          stock: finalStock,
          playerHands: finalHands,
          tableStick,
          stickLedRank: originalLedRank,
          playersMustPlay: [],
          stickFighters: fightersFromTable,
          currentPlayerId: nextFighter,
          humanPendingKlar: false,
          nextPlayerIdAfterKlar: null,
        };
      }
    }
  }

  if (playersWhoHaventPlayed.length > 0) {
    const leader = tableStick[0].playerId;
    let nextId: PlayerId | null = null;
    for (let i = 1; i <= s.playerIds.length; i++) {
      const candidate = s.playerIds[(s.playerIds.indexOf(leader) + i) % s.playerIds.length];
      if (playersWhoHaventPlayed.includes(candidate)) {
        nextId = candidate;
        break;
      }
    }
    if (nextId) {
      const { finalStock, finalHands } = doDrawForHuman();
      return {
        ...s,
        stock: finalStock,
        playerHands: finalHands,
        tableStick,
        stickLedRank: ledRank,
        playersMustPlay: [],
        stickFighters: [],
        currentPlayerId: nextId,
        humanPendingKlar: false,
        nextPlayerIdAfterKlar: null,
      };
    }
  }

  if (someonePlayedHigher) {
    const originalFightRank = originalLedRank;
    const winner = getStickWinner(tableStick, originalFightRank);
    const { finalStock, finalHands } = doDrawForHuman();
    return {
      ...s,
      stock: finalStock,
      playerHands: finalHands,
      tableStick,
      stickLedRank: null,
      playersMustPlay: [],
      stickFighters: [],
      currentPlayerId: winner,
      stickShowingWinner: winner,
      humanPendingKlar: false,
      nextPlayerIdAfterKlar: null,
    };
  }

  const fighters = fightersFromTable;

  if (fighters.length > 1) {
    const allFightersPlayed = fighters.every((fid) => {
      const cards = tableStick.filter((sc) => sc.playerId === fid);
      if (cards.length < 2) return false;
      const lastCard = cards[cards.length - 1];
      return lastCard.card.rank !== originalLedRank;
    });
    if (!allFightersPlayed) {
      const needsFightCard = (fid: PlayerId) => {
        const cards = tableStick.filter((sc) => sc.playerId === fid);
        return cards.length >= 1 && cards[cards.length - 1].card.rank === originalLedRank;
      };
      const nextFighter =
        fighters.find(needsFightCard) ??
        fighters.reduce((a, b) =>
          tableStick.findIndex((sc) => sc.playerId === a && sc.card.rank === originalLedRank) <
          tableStick.findIndex((sc) => sc.playerId === b && sc.card.rank === originalLedRank)
            ? a
            : b
        );
      if (nextFighter) {
        const { finalStock, finalHands } = doDrawForHuman();
        return {
          ...s,
          stock: finalStock,
          playerHands: finalHands,
          tableStick,
          stickLedRank: originalLedRank,
          playersMustPlay: [],
          stickFighters: fighters,
          currentPlayerId: nextFighter,
          humanPendingKlar: false,
          nextPlayerIdAfterKlar: null,
        };
      }
    }
  }

  const originalFightRank = originalLedRank ?? tableStick[0]?.card.rank ?? ledRank;
  const winner = getStickWinner(tableStick, originalFightRank);
  const { finalStock, finalHands } = doDrawForHuman();
  return {
    ...s,
    stock: finalStock,
    playerHands: finalHands,
    tableStick,
    stickLedRank: null,
    playersMustPlay: [],
    stickFighters: [],
    currentPlayerId: winner,
    stickShowingWinner: winner,
    humanPendingKlar: false,
    nextPlayerIdAfterKlar: null,
  };
}

function getDrawOrder(playerIds: PlayerId[], after: PlayerId): PlayerId[] {
  const i = playerIds.indexOf(after);
  return [...playerIds.slice(i), ...playerIds.slice(0, i)];
}
