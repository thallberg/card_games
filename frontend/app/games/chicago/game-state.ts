import type { Card, PlayerId } from "./types";
import { createDeck, shuffle, sortHand } from "./deck";
import { HAND_SIZE, MAX_DRAW_ROUNDS } from "./constants";

export type ChicagoPhase =
  | "draw"      // Välj kort att kasta, max 3 omgångar
  | "play"      // Utspelet: 5 stick
  | "roundEnd"  // Visa poäng, nästa rond
  | "gameOver";

export type GameState = {
  phase: ChicagoPhase;
  deck: Card[];
  playerHands: Record<PlayerId, Card[]>;
  /** Vilken kast-omgång (0, 1, 2). */
  drawRound: number;
  /** När spelaren ska välja öppet/dolt kort: ett öppet, ett dolt, tempHand och antal plock kvar. */
  drawPick: {
    openCard: Card;
    hiddenCard: Card;
    picksLeft: number;
    tempHand: Card[];
    /** Om detta är ett gratis "byt alla 5" – då ska turordning inte bytas vid slut. */
    isFreeSwap?: boolean;
  } | null;
  /** Antal gratis "byt alla 5" använt denna rond (max 3, endast omgång 1). */
  freeSwapUsedCount: number;
  /** Vem som väljer att kasta (bara p1 i single player). */
  currentPlayerId: PlayerId;
  /** Vilket stick (0..4). */
  trickNumber: number;
  /** Vem som leder nuvarande stick. */
  trickLeader: PlayerId;
  /** Korten spelade i nuvarande stick [ledare, andra]. Andra är null tills båda lagt. */
  trickCards: [Card, Card | null] | null;
  /** Avslutade stick denna rond (för att visa historik). */
  completedTricks: { leaderCard: Card; followerCard: Card; trickLeader: PlayerId; winner: PlayerId }[];
  /** Sammanlagda poäng per spelare. */
  playerScores: Record<PlayerId, number>;
  /** Vem som vann sista sticket (utspelet) denna rond. */
  roundUtspeletWinner: PlayerId | null;
  /** Handpoäng denna rond (par, triss, färg) – sätts vid roundEnd. */
  roundHandPoints: Record<PlayerId, number>;
  /** Händer när utspelet började (för handpoäng). */
  playPhaseHands: Record<PlayerId, Card[]>;
  rondNumber: number;
};

const PLAYER_IDS: PlayerId[] = ["p1", "p2"];

export function createInitialState(): GameState {
  const deck = shuffle(createDeck());
  const hands: Record<PlayerId, Card[]> = {
    p1: sortHand(deck.slice(0, HAND_SIZE)),
    p2: sortHand(deck.slice(HAND_SIZE, HAND_SIZE * 2)),
  };
  const deckRemaining = deck.slice(HAND_SIZE * 2);
  return {
    phase: "draw",
    deck: deckRemaining,
    playerHands: hands,
    drawRound: 0,
    drawPick: null,
    freeSwapUsedCount: 0,
    currentPlayerId: "p1",
    trickNumber: 0,
    trickLeader: "p2",
    trickCards: null,
    completedTricks: [],
    playerScores: { p1: 0, p2: 0 },
    roundUtspeletWinner: null,
    roundHandPoints: { p1: 0, p2: 0 },
    playPhaseHands: { p1: [], p2: [] },
    rondNumber: 1,
  };
}

export function getPlayerIds(): PlayerId[] {
  return [...PLAYER_IDS];
}

export function getNextPlayerId(current: PlayerId): PlayerId {
  return current === "p1" ? "p2" : "p1";
}
