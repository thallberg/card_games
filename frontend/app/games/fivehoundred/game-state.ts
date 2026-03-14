import type { Card, Meld, PlayerId } from "./types";
import { createDeck, shuffle, sortHand } from "./deck";
import { HAND_SIZE, POINTS_TO_WIN } from "./constants";

export type GameState = {
  stock: Card[];
  discard: Card[];
  melds: Meld[];
  currentPlayerId: PlayerId | null;
  playerHands: Record<PlayerId, Card[]>;
  playerScores: Record<PlayerId, number>;
  phase: "draw" | "meldOrDiscard" | "roundEnd" | "gameOver";
  lastDraw: "stock" | "discard" | null;
  /** Antal kort nuvarande spelare lagt ut denna tur (för regel: tog kast högen → måste lägga minst 3). */
  cardsLaidThisTurn: number;
  /** Meld-ids som nyligen lades ut – visas med grön ram tills nästa tur. */
  lastLaidMeldIds?: string[];
  roundNumber: number;
  winnerId: PlayerId | null;
};

function getPlayerIdsFromState(state: GameState): PlayerId[] {
  return Object.keys(state.playerHands) as PlayerId[];
}

export function createInitialState(numPlayers: number = 2): GameState {
  const playerIds: PlayerId[] = Array.from(
    { length: numPlayers },
    (_, i) => `p${i + 1}` as PlayerId
  );
  const deck = shuffle(createDeck());
  const hands: Record<PlayerId, Card[]> = {} as Record<PlayerId, Card[]>;
  let idx = 0;
  for (const id of playerIds) {
    hands[id] = sortHand(deck.slice(idx, idx + HAND_SIZE));
    idx += HAND_SIZE;
  }
  const stock = deck.slice(HAND_SIZE * playerIds.length);
  const discard = stock.length > 0 ? [stock.pop()!] : [];
  const scores: Record<PlayerId, number> = {} as Record<PlayerId, number>;
  for (const id of playerIds) scores[id] = 0;
  return {
    stock,
    discard,
    melds: [],
    currentPlayerId: playerIds[0],
    playerHands: hands,
    playerScores: scores,
    phase: "draw",
    lastDraw: null,
    cardsLaidThisTurn: 0,
    roundNumber: 1,
    winnerId: null,
  };
}

export function getPlayerIds(state: GameState): PlayerId[] {
  return getPlayerIdsFromState(state);
}

export function getNextPlayerId(current: PlayerId, state: GameState): PlayerId {
  const ids = getPlayerIdsFromState(state);
  const i = ids.indexOf(current);
  return ids[(i + 1) % ids.length];
}

export function checkGameOver(scores: Record<PlayerId, number>): PlayerId | null {
  for (const id of Object.keys(scores) as PlayerId[]) {
    if (scores[id] >= POINTS_TO_WIN) return id;
  }
  return null;
}

/** New round: keep scores and roundNumber, new deck and deal. First player rotates by round. */
export function createNewRoundState(current: GameState): GameState {
  const playerIds = getPlayerIdsFromState(current);
  const deck = shuffle(createDeck());
  const hands: Record<PlayerId, Card[]> = {} as Record<PlayerId, Card[]>;
  let idx = 0;
  for (const id of playerIds) {
    hands[id] = sortHand(deck.slice(idx, idx + HAND_SIZE));
    idx += HAND_SIZE;
  }
  const stock = deck.slice(HAND_SIZE * playerIds.length);
  const discard = stock.length > 0 ? [stock.pop()!] : [];
  const newRoundNumber = current.roundNumber + 1;
  const firstPlayerIndex = (newRoundNumber - 1) % playerIds.length;
  return {
    stock,
    discard,
    melds: [],
    currentPlayerId: playerIds[firstPlayerIndex],
    playerHands: hands,
    playerScores: { ...current.playerScores },
    phase: "draw",
    lastDraw: null,
    cardsLaidThisTurn: 0,
    roundNumber: newRoundNumber,
    winnerId: null,
  };
}
