import type { Card, PlayerId, Rank } from "./types";
import { createDeck, shuffle, sortHand } from "./deck";
import { HAND_SIZE_PHASE1, MIN_PLAYERS, MAX_PLAYERS } from "./constants";
import { RANK_VALUE } from "./types";

export type SkitgubbePhase =
  | "setup"      // Välj antal spelare
  | "sticks"     // Fas 1: plocka stick
  | "skitgubbe"  // Dela ut straffkort till skitgubbe
  | "play"       // Fas 2: bli av med kort
  | "gameOver";

/** Ett kort på bordet i ett stick, med vem som lade det. */
export type StickCard = { playerId: PlayerId; card: Card };

/** Ett stick på bordet i fas 2 (trick). */
export type TrickCard = { playerId: PlayerId; card: Card };

export type GameState = {
  phase: SkitgubbePhase;
  numPlayers: number;
  playerIds: PlayerId[];
  stock: Card[];
  playerHands: Record<PlayerId, Card[]>;
  /** Sista kortet i högen (visas när 1 kort kvar) – bestämmer trumf. */
  lastRevealedCard: Card | null;
  trumpSuit: Card["suit"] | null;
  /** Spelare som tog sista sticket (får lastRevealedCard). */
  lastStickWinner: PlayerId | null;

  // Fas 1 – sticks
  /** Kort på nuvarande stick. */
  tableStick: StickCard[];
  /** Valör som lades ut – alla med den valören MÅSTE lägga. */
  stickLedRank: Rank | null;
  /** Spelare som måste lägga (har stickLedRank) men inte lagt än. */
  playersMustPlay: PlayerId[];
  /** Spelare som "slåss" om sticket (har lagt stickLedRank) – lägger nästa kort. */
  stickFighters: PlayerId[];
  /** Vems tur att leda/lägga. */
  currentPlayerId: PlayerId;
  sticksWon: Record<PlayerId, number>;
  /** Kort varje spelare vunnit från stick (visas som hög). */
  wonCards: Record<PlayerId, Card[]>;
  /** Människan har lagt och ska klicka Klar innan nästa. */
  humanPendingKlar: boolean;
  /** Nästa spelare efter att människan klickat Klar. */
  nextPlayerIdAfterKlar: PlayerId | null;
  /** Stick som just avgjordes – visa på bordet innan vi flyttar till vunna. */
  stickShowingWinner: PlayerId | null;

  // Fas 2 – play
  /** Nuvarande trick på bordet. En spelare kan ha lagt flera kort (stege). */
  tableTrick: TrickCard[];
  /** Vem som ledde tricket. */
  trickLeader: PlayerId | null;
  /** Högsta kort/stege som måste slås (färg + valör). */
  trickLeadSuit: Card["suit"] | null;
  trickHighRank: Rank | null;
  /** Spelare som vunnit (0 kort kvar). */
  winnerId: PlayerId | null;
  /** Spelare som blev skitgubbe (fick straffkort) – sätts vid övergång till play. */
  skitgubbePlayerId: PlayerId | null;
  /** Trick just avgjordes – visa 2 sec innan vi rensar. */
  trickShowingWinner: PlayerId | null;
};

function createPlayerIds(count: number): PlayerId[] {
  return Array.from({ length: count }, (_, i) => `p${i + 1}` as PlayerId);
}

export function createInitialState(numPlayers: number): GameState {
  const playerIds = createPlayerIds(
    Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, numPlayers))
  );
  const deck = shuffle(createDeck());
  const hands: Record<PlayerId, Card[]> = {};
  let idx = 0;
  for (const id of playerIds) {
    hands[id] = sortHand(deck.slice(idx, idx + HAND_SIZE_PHASE1));
    idx += HAND_SIZE_PHASE1;
  }
  const stock = deck.slice(HAND_SIZE_PHASE1 * playerIds.length);
  const sticksWon: Record<PlayerId, number> = {};
  const wonCards: Record<PlayerId, Card[]> = {};
  for (const id of playerIds) {
    sticksWon[id] = 0;
    wonCards[id] = [];
  }

  return {
    phase: "sticks",
    numPlayers: playerIds.length,
    playerIds,
    stock,
    playerHands: hands,
    lastRevealedCard: null,
    trumpSuit: null,
    lastStickWinner: null,
    tableStick: [],
    stickLedRank: null,
    playersMustPlay: [],
    stickFighters: [],
    currentPlayerId: playerIds[0],
    sticksWon,
    wonCards,
    humanPendingKlar: false,
    nextPlayerIdAfterKlar: null,
    stickShowingWinner: null,
    tableTrick: [],
    trickLeader: null,
    trickLeadSuit: null,
    trickHighRank: null,
    winnerId: null,
    skitgubbePlayerId: null,
    trickShowingWinner: null,
  };
}

export function getPlayerIds(state: GameState): PlayerId[] {
  return [...state.playerIds];
}

export function getNextPlayerId(state: GameState, current: PlayerId): PlayerId {
  const i = state.playerIds.indexOf(current);
  return state.playerIds[(i + 1) % state.playerIds.length];
}

export function getPrevPlayerId(state: GameState, current: PlayerId): PlayerId {
  const i = state.playerIds.indexOf(current);
  return state.playerIds[(i - 1 + state.playerIds.length) % state.playerIds.length];
}

/**
 * Hitta vinnare av sticket.
 * Vanligt fall: den med högst valör vinner.
 * Fight avbryts om någon lägger högre – då vinner högst kort.
 * Fight sker endast om alla har lagt ledvalör (ingen lägger över).
 */
export function getStickWinner(stick: StickCard[], leadRank: Rank | null): PlayerId {
  if (stick.length === 0) return "p1";
  const ledVal = leadRank ? RANK_VALUE[leadRank] : -1;
  const someonePlayedHigher = stick.some((sc) => RANK_VALUE[sc.card.rank] > ledVal);
  const hasFight =
    leadRank &&
    !someonePlayedHigher &&
    stick.filter((sc) => sc.card.rank === leadRank).length >= 2;
  if (!hasFight) {
    let best = stick[0];
    for (const sc of stick) {
      if (RANK_VALUE[sc.card.rank] > RANK_VALUE[best.card.rank]) best = sc;
    }
    return best.playerId;
  }
  const fighterIds = [...new Set(
    stick.filter((sc) => sc.card.rank === leadRank).map((sc) => sc.playerId)
  )];
  const fightCards = fighterIds.map((fid) => {
    const cards = stick.filter((sc) => sc.playerId === fid);
    return cards[cards.length - 1];
  });
  if (fightCards.length === 0) return stick[0].playerId;
  let best = fightCards[0];
  for (const sc of fightCards) {
    if (RANK_VALUE[sc.card.rank] > RANK_VALUE[best.card.rank]) best = sc;
  }
  return best.playerId;
}
