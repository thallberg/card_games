import type { Card, PlayerId, Rank } from "./types";
import { createDeck, shuffle, sortHand } from "./deck";
import { INITIAL_HAND_SIZE, MIN_PLAYERS, MAX_PLAYERS, CARDS_PER_QUARTET, DRAW_WHEN_EMPTY } from "./constants";

export type FinnsisjonPhase = "setup" | "play" | "gameOver";

/** En hög på bordet: [0..n-2] dolda, [n-1] öppet. tableau[i] har i+1 kort. */
export type TableauPile = Card[];

export type GameState = {
  phase: FinnsisjonPhase;
  numPlayers: number;
  playerIds: PlayerId[];
  /** 7 högar. Hög i har i dolda + 1 öppet. */
  tableau: TableauPile[];
  /** Drag-hög (sjön). */
  sjön: Card[];
  playerHands: Record<PlayerId, Card[]>;
  /** Antal kompletta kvartetter per spelare. */
  quartetsWon: Record<PlayerId, number>;
  currentPlayerId: PlayerId;
  /** Senaste fråga (för UI). */
  lastAsk: { from: PlayerId; to: PlayerId; rank: Rank } | null;
  /** true om senaste drag var "finns i sjön" (visa meddelande). */
  lastWasFinnsISjon: boolean;
  winnerId: PlayerId | null;
};

function createPlayerIds(count: number): PlayerId[] {
  return Array.from({ length: count }, (_, i) => `p${i + 1}` as PlayerId);
}

export function createInitialState(numPlayers: number): GameState {
  const n = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, numPlayers));
  const playerIds = createPlayerIds(n);
  const deck = shuffle(createDeck()); // 52 kort
  const handSize = Math.min(INITIAL_HAND_SIZE, Math.floor(deck.length / n));
  const playerHands: Record<PlayerId, Card[]> = {};
  let idx = 0;
  for (const id of playerIds) {
    const hand: Card[] = [];
    for (let i = 0; i < handSize; i++) {
      hand.push(deck[idx++]);
    }
    playerHands[id] = sortHand(hand);
  }
  const sjön = deck.slice(idx);
  const quartetsWon: Record<PlayerId, number> = {};
  for (const id of playerIds) quartetsWon[id] = 0;

  return {
    phase: "play",
    numPlayers: n,
    playerIds,
    tableau: [],
    sjön,
    playerHands,
    quartetsWon,
    currentPlayerId: playerIds[0],
    lastAsk: null,
    lastWasFinnsISjon: false,
    winnerId: null,
  };
}

export function getPlayerIds(state: GameState): PlayerId[] {
  return [...state.playerIds];
}

export function getNextPlayerId(state: GameState, current: PlayerId): PlayerId {
  const i = state.playerIds.indexOf(current);
  return state.playerIds[(i + 1) % state.playerIds.length];
}

/** Räkna kvartetter i en hand (antal rank som förekommer 4 gånger). */
export function countQuartetsInHand(cards: Card[]): number {
  const byRank: Record<string, number> = {};
  for (const c of cards) byRank[c.rank] = (byRank[c.rank] ?? 0) + 1;
  return Object.values(byRank).filter((n) => n === CARDS_PER_QUARTET).length;
}

/** Ta bort kompletta kvartetter från hand och öka quartetsWon. */
function pullQuartetsFromHand(hand: Card[]): { newHand: Card[]; quartets: number } {
  const byRank: Record<string, Card[]> = {};
  for (const c of hand) {
    if (!byRank[c.rank]) byRank[c.rank] = [];
    byRank[c.rank].push(c);
  }
  let quartets = 0;
  const newHand: Card[] = [];
  for (const rank of Object.keys(byRank)) {
    const arr = byRank[rank];
    if (arr.length === CARDS_PER_QUARTET) quartets++;
    else newHand.push(...arr);
  }
  return { newHand, quartets };
}

/** Kolla om spelet är slut: sjön tom och alla har 0 kort (eller bara en med kort kvar). */
function checkGameOver(state: GameState): GameState {
  const handsEmpty = state.playerIds.every((id) => (state.playerHands[id]?.length ?? 0) === 0);
  if (state.sjön.length > 0 || !handsEmpty) return state;
  const scores = state.playerIds.map((id) => state.quartetsWon[id] ?? 0);
  const maxScore = Math.max(...scores);
  const winners = state.playerIds.filter((id) => (state.quartetsWon[id] ?? 0) === maxScore);
  return {
    ...state,
    phase: "gameOver",
    winnerId: winners.length === 1 ? winners[0]! : null,
  };
}

/** Spelare X frågar spelare Y om valör rank. Returnerar ny state. */
export function applyAsk(
  state: GameState,
  from: PlayerId,
  to: PlayerId,
  rank: Rank
): GameState {
  if (state.phase !== "play" || state.currentPlayerId !== from) return state;
  const fromHand = state.playerHands[from] ?? [];
  if (!fromHand.some((c) => c.rank === rank)) return state;
  const toHand = state.playerHands[to] ?? [];
  const matching = toHand.filter((c) => c.rank === rank);

  const newHands = { ...state.playerHands };
  if (matching.length > 0) {
    newHands[to] = toHand.filter((c) => c.rank !== rank);
    newHands[from] = sortHand([...fromHand, ...matching]);
    const { newHand, quartets } = pullQuartetsFromHand(newHands[from]!);
    newHands[from] = sortHand(newHand);
    const quartetsWon = { ...state.quartetsWon };
    quartetsWon[from] = (quartetsWon[from] ?? 0) + quartets;
    return checkGameOver({
      ...state,
      playerHands: newHands,
      quartetsWon,
      lastAsk: { from, to, rank },
      lastWasFinnsISjon: false,
    });
  }

  return {
    ...state,
    lastAsk: { from, to, rank },
    lastWasFinnsISjon: true,
  };
}

/** Spelare drar ett valt kort från sjön (efter "finns i sjön"). Turen går vidare. */
export function applyDrawCardFromSjön(state: GameState, playerId: PlayerId, cardIndex: number): GameState {
  if (state.phase !== "play" || state.currentPlayerId !== playerId || !state.lastWasFinnsISjon)
    return state;
  const sjön = [...state.sjön];
  if (cardIndex < 0 || cardIndex >= sjön.length) return state;
  const drawn = sjön.splice(cardIndex, 1)[0]!;
  const hand = [...(state.playerHands[playerId] ?? []), drawn];
  const { newHand, quartets } = pullQuartetsFromHand(hand);
  const quartetsWon = { ...state.quartetsWon };
  quartetsWon[playerId] = (quartetsWon[playerId] ?? 0) + quartets;
  const newHands = { ...state.playerHands, [playerId]: sortHand(newHand) };
  const next = checkGameOver({
    ...state,
    sjön,
    playerHands: newHands,
    quartetsWon,
    currentPlayerId: getNextPlayerId(state, playerId),
    lastWasFinnsISjon: false,
  });
  return next;
}

/** Spelare drar ett kort från sjön (slumpat – används av AI). */
export function applyDrawFromSjön(state: GameState, playerId: PlayerId): GameState {
  if (state.phase !== "play" || state.currentPlayerId !== playerId || !state.lastWasFinnsISjon)
    return state;
  const sjön = [...state.sjön];
  if (sjön.length === 0) {
    return {
      ...state,
      currentPlayerId: getNextPlayerId(state, playerId),
      lastWasFinnsISjon: false,
    };
  }
  const idx = Math.floor(Math.random() * sjön.length);
  return applyDrawCardFromSjön(state, playerId, idx);
}

/** Om spelaren har 0 kort: plocka 7 från sjön (eller vänta om tom). */
export function applyDrawSevenIfEmpty(state: GameState, playerId: PlayerId): GameState {
  if (state.phase !== "play") return state;
  const hand = state.playerHands[playerId] ?? [];
  if (hand.length > 0) return state;
  const sjön = [...state.sjön];
  const toDraw = Math.min(DRAW_WHEN_EMPTY, sjön.length);
  if (toDraw === 0) return state;
  const drawn = sjön.splice(0, toDraw);
  const newHands = { ...state.playerHands, [playerId]: sortHand(drawn) };
  return { ...state, sjön, playerHands: newHands };
}
