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
  roundNumber: number;
  winnerId: PlayerId | null;
};

const PLAYER_IDS: PlayerId[] = ["p1", "p2", "p3"];

function createInitialScores(): Record<PlayerId, number> {
  const o: Record<string, number> = {};
  for (const id of PLAYER_IDS) o[id] = 0;
  return o as Record<PlayerId, number>;
}

export function createInitialState(): GameState {
  const deck = shuffle(createDeck());
  const hands: Record<PlayerId, Card[]> = {};
  let idx = 0;
  for (const id of PLAYER_IDS) {
    hands[id] = sortHand(deck.slice(idx, idx + HAND_SIZE));
    idx += HAND_SIZE;
  }
  const stock = deck.slice(HAND_SIZE * PLAYER_IDS.length);
  const discard = stock.length > 0 ? [stock.pop()!] : [];
  return {
    stock,
    discard,
    melds: [],
    currentPlayerId: PLAYER_IDS[0],
    playerHands: hands,
    playerScores: createInitialScores(),
    phase: "draw",
    lastDraw: null,
    roundNumber: 1,
    winnerId: null,
  };
}

export function getPlayerIds(): PlayerId[] {
  return [...PLAYER_IDS];
}

export function getNextPlayerId(current: PlayerId): PlayerId {
  const i = PLAYER_IDS.indexOf(current);
  return PLAYER_IDS[(i + 1) % PLAYER_IDS.length];
}

export function checkGameOver(scores: Record<PlayerId, number>): PlayerId | null {
  for (const id of PLAYER_IDS) {
    if (scores[id] >= POINTS_TO_WIN) return id;
  }
  return null;
}

/** Ny rond: behåller poäng och roundNumber, ny kortlek och giv. */
export function createNewRoundState(current: GameState): GameState {
  const deck = shuffle(createDeck());
  const hands: Record<PlayerId, Card[]> = {} as Record<PlayerId, Card[]>;
  let idx = 0;
  for (const id of PLAYER_IDS) {
    hands[id] = sortHand(deck.slice(idx, idx + HAND_SIZE));
    idx += HAND_SIZE;
  }
  const stock = deck.slice(HAND_SIZE * PLAYER_IDS.length);
  const discard = stock.length > 0 ? [stock.pop()!] : [];
  return {
    stock,
    discard,
    melds: [],
    currentPlayerId: PLAYER_IDS[0],
    playerHands: hands,
    playerScores: { ...current.playerScores },
    phase: "draw",
    lastDraw: null,
    roundNumber: current.roundNumber + 1,
    winnerId: null,
  };
}
