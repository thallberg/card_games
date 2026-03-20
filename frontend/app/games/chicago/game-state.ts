import type { Card, PlayerId } from "./types";
import { RANK_VALUE } from "./types";
import { createDeck, shuffle, sortHand } from "./deck";
import { HAND_SIZE, MAX_DRAW_ROUNDS } from "./constants";
import { dealHandsFromShuffledDeckStart } from "@/lib/deal";

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
  /** Antal kort motståndaren kastade senast (singleplayer – visas när det är vår tur). */
  lastOpponentDiscardCount?: number;
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
  const { hands, remainingDeck: deckRemaining } = dealHandsFromShuffledDeckStart({
    deck,
    playerIds,
    handSize: HAND_SIZE,
    sortHand,
  });
  const scores: Record<PlayerId, number> = {} as Record<PlayerId, number>;
  const roundPoints: Record<PlayerId, number> = {} as Record<PlayerId, number>;
  const playHands: Record<PlayerId, Card[]> = {} as Record<PlayerId, Card[]>;
  for (const id of playerIds) {
    scores[id] = 0;
    roundPoints[id] = 0;
    playHands[id] = [];
  }
  return {
    phase: "draw",
    deck: deckRemaining,
    playerHands: hands,
    drawRound: 0,
    drawPick: null,
    freeSwapUsedCount: 0,
    currentPlayerId: "p1",
    trickNumber: 0,
    trickLeader: playerIds[1] ?? "p2",
    trickCards: null,
    completedTricks: [],
    playerScores: scores,
    roundUtspeletWinner: null,
    roundHandPoints: roundPoints,
    playPhaseHands: playHands,
    rondNumber: 1,
    lastOpponentDiscardCount: undefined,
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

/** Winner of a two-card trick (leader vs follower). */
export function getTrickWinner(
  lead: Card,
  follow: Card,
  leader: PlayerId,
  state: GameState
): PlayerId {
  if (follow.suit !== lead.suit) return leader;
  if (RANK_VALUE[follow.rank] > RANK_VALUE[lead.rank]) return getNextPlayerId(leader, state);
  return leader;
}
