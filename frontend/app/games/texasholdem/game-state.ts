import type { Card, PlayerSeat, BettingPhase } from "./types";
import { createDeck, shuffle } from "./deck";
import { MIN_PLAYERS, MAX_PLAYERS } from "./constants";
import { bestHand, compareRankedHands } from "./hand-rankings";

export type TexasHoldemState = {
  phase: "setup" | "playing" | "handOver" | "gameOver";
  /** Spelare (ordning: seatIndex 0,1,...). */
  seats: PlayerSeat[];
  /** Antal spelare (2–6). */
  numPlayers: number;
  /** Buy-in i enheter (samma för alla). */
  buyIn: number;
  /** Big blind i enheter. */
  bigBlind: number;
  /** Small blind = bigBlind/2. */
  smallBlind: number;
  /** Index i seats för dealer (button). */
  dealerIndex: number;
  /** Index för den som ska agera nu (preflop: till vänster om BB). */
  currentActorIndex: number;
  /** Nuvarande betting-fas. */
  bettingPhase: BettingPhase;
  /** Community cards (flop 3, turn +1, river +1). */
  board: Card[];
  /** Hole cards per spelare (index = seatIndex). Alla får 2 kort. */
  holeCards: Card[][];
  /** Kortlek (resten av leken efter utdelning). */
  deck: Card[];
  /** Pot (totalt i mitten). */
  pot: number;
  /** Nuvarande minsta bet att matcha denna runda (för raise). */
  currentBet: number;
  /** Min raise = big blind (no-limit: min raise = current bet eller BB). */
  minRaise: number;
  /** Vinnare av senaste handen (för visning). */
  lastHandWinnerIndex: number | null;
  /** Spelare kvar i handen (inte folded). */
  activeInHand: number[];
};

function createSeats(numPlayers: number, buyIn: number): PlayerSeat[] {
  const seats: PlayerSeat[] = [];
  for (let i = 0; i < numPlayers; i++) {
    seats.push({
      id: `p${i + 1}`,
      name: i === 0 ? "Du" : `Spelare ${i + 1}`,
      stack: buyIn,
      betThisHand: 0,
      actedThisRound: false,
      folded: false,
      isAllIn: false,
      seatIndex: i,
    });
  }
  return seats;
}

export function createInitialSetupState(): Omit<TexasHoldemState, "phase"> & { phase: "setup" } {
  return {
    phase: "setup",
    seats: [],
    numPlayers: 2,
    buyIn: 2000,
    bigBlind: 20,
    smallBlind: 10,
    dealerIndex: 0,
    currentActorIndex: 0,
    bettingPhase: "preflop",
    board: [],
    holeCards: [],
    deck: [],
    pot: 0,
    currentBet: 0,
    minRaise: 20,
    lastHandWinnerIndex: null,
    activeInHand: [],
  };
}

export function startNewGame(
  numPlayers: number,
  buyIn: number,
  bigBlind: number
): TexasHoldemState {
  const smallBlind = Math.floor(bigBlind / 2);
  const seats = createSeats(numPlayers, buyIn);
  const deck = shuffle(createDeck());
  const holeCards: Card[][] = [];
  for (let i = 0; i < numPlayers; i++) {
    holeCards.push([deck.pop()!, deck.pop()!]);
  }
  const dealerIndex = 0;
  const sbIndex = numPlayers === 2 ? 0 : 1;
  const bbIndex = numPlayers === 2 ? 1 : 2;
  const seatsWithBlinds = seats.map((s, i) => {
    let stack = s.stack;
    let betThisHand = 0;
    if (i === sbIndex) {
      const post = Math.min(smallBlind, stack);
      stack -= post;
      betThisHand = post;
    } else if (i === bbIndex) {
      const post = Math.min(bigBlind, stack);
      stack -= post;
      betThisHand = post;
    }
    return {
      ...s,
      stack,
      betThisHand,
      actedThisRound: i === sbIndex || i === bbIndex,
      folded: false,
      isAllIn: stack <= 0,
    };
  });
  const pot = 0;
  const currentActorIndex = numPlayers === 2 ? 0 : 2;
  const activeInHand = seatsWithBlinds.map((_, i) => i).filter((i) => !seatsWithBlinds[i].folded);

  return {
    phase: "playing",
    seats: seatsWithBlinds,
    numPlayers,
    buyIn,
    bigBlind,
    smallBlind,
    dealerIndex,
    currentActorIndex: currentActorIndex % numPlayers,
    bettingPhase: "preflop",
    board: [],
    holeCards,
    deck,
    pot,
    currentBet: bigBlind,
    minRaise: bigBlind,
    lastHandWinnerIndex: null,
    activeInHand,
  };
}

export function getSmallBlind(bigBlind: number): number {
  return Math.floor(bigBlind / 2);
}

export function getTotalPot(state: TexasHoldemState): number {
  const inPot = state.seats.reduce((sum, s) => sum + (s.betThisHand ?? 0), 0);
  return state.pot + inPot;
}

function nextSeatWithChips(seats: PlayerSeat[], from: number): number {
  const n = seats.length;
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n;
    if (seats[idx].stack > 0) return idx;
  }
  return from;
}

function nextActiveSeatIndex(state: TexasHoldemState, from: number): number {
  const n = state.numPlayers;
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n;
    if (!state.seats[idx].folded && !state.seats[idx].isAllIn) return idx;
  }
  return from;
}

function allActedThisRound(state: TexasHoldemState): boolean {
  const active = state.activeInHand.filter((i) => !state.seats[i].isAllIn);
  if (active.length <= 1) return true;
  const firstToAct = state.bettingPhase === "preflop"
    ? (state.dealerIndex + state.numPlayers + (state.numPlayers === 2 ? 1 : 2)) % state.numPlayers
    : nextActiveSeatIndex(state, state.dealerIndex);
  let idx = firstToAct;
  do {
    if (!state.seats[idx].actedThisRound && !state.seats[idx].folded && !state.seats[idx].isAllIn)
      return false;
    idx = nextActiveSeatIndex(state, idx);
  } while (idx !== firstToAct);
  return true;
}

function advanceBettingPhase(state: TexasHoldemState): TexasHoldemState {
  const addedPot = state.seats.reduce((sum, s) => sum + s.betThisHand, 0);
  const seats = state.seats.map((s) => ({ ...s, actedThisRound: false, betThisHand: 0 }));
  const pot = state.pot + addedPot;
  const active = state.activeInHand.filter((i) => !seats[i].folded);
  if (active.length <= 1) {
    const winner = active[0];
    const newStacks = seats.map((s, i) =>
      i === winner ? { ...s, stack: s.stack + pot } : { ...s }
    );
    return {
      ...state,
      phase: "handOver",
      seats: newStacks,
      pot: 0,
      currentBet: 0,
      lastHandWinnerIndex: winner,
    };
  }
  const nextPhase: BettingPhase =
    state.bettingPhase === "preflop" ? "flop"
    : state.bettingPhase === "flop" ? "turn"
    : state.bettingPhase === "turn" ? "river"
    : "showdown";
  const deck = [...state.deck];
  let board = [...state.board];
  if (nextPhase === "flop") {
    deck.pop();
    board = [deck.pop()!, deck.pop()!, deck.pop()!];
  } else if (nextPhase === "turn") {
    deck.pop();
    board = [...board, deck.pop()!];
  } else if (nextPhase === "river") {
    deck.pop();
    board = [...board, deck.pop()!];
  }
  if (nextPhase === "showdown") {
    return doShowdown({ ...state, seats, pot });
  }
  const firstActor = nextActiveSeatIndex(
    { ...state, seats, board } as TexasHoldemState,
    state.dealerIndex
  );
  return {
    ...state,
    seats,
    pot,
    currentBet: 0,
    bettingPhase: nextPhase,
    board,
    deck,
    currentActorIndex: firstActor,
  };
}

function doShowdown(state: TexasHoldemState): TexasHoldemState {
  const active = state.activeInHand.filter((i) => !state.seats[i].folded);
  if (active.length === 0) return state;
  if (active.length === 1) {
    const winner = active[0];
    const totalPot = state.pot + state.seats.reduce((s, seat) => s + seat.betThisHand, 0);
    const newSeats = state.seats.map((s, i) =>
      i === winner ? { ...s, stack: s.stack + totalPot } : s
    );
    return {
      ...state,
      phase: "handOver",
      seats: newSeats,
      pot: 0,
      currentBet: 0,
      lastHandWinnerIndex: winner,
    };
  }
  const ranked = active.map((i) => ({
    index: i,
    hand: bestHand(state.holeCards[i] ?? [], state.board),
  }));
  ranked.sort((a, b) => compareRankedHands(b.hand, a.hand));
  const winnerIndex = ranked[0].index;
  const totalPot = state.pot + state.seats.reduce((s, seat) => s + seat.betThisHand, 0);
  const newSeats = state.seats.map((s, i) =>
    i === winnerIndex ? { ...s, stack: s.stack + totalPot } : s
  );
  return {
    ...state,
    phase: "handOver",
    seats: newSeats,
    pot: 0,
    currentBet: 0,
    lastHandWinnerIndex: winnerIndex,
  };
}

export function fold(state: TexasHoldemState, seatIndex: number): TexasHoldemState {
  if (state.phase !== "playing" || state.currentActorIndex !== seatIndex) return state;
  const seats = state.seats.map((s, i) =>
    i === seatIndex ? { ...s, folded: true } : s
  );
  const activeInHand = state.activeInHand.filter((i) => !seats[i].folded);
  const nextState = { ...state, seats, activeInHand };
  if (activeInHand.length <= 1) {
    const winner = activeInHand[0];
    const totalPot = nextState.pot + seats.reduce((s, seat) => s + seat.betThisHand, 0);
    const newSeats = seats.map((s, i) =>
      i === winner ? { ...s, stack: s.stack + totalPot } : s
    );
    return {
      ...nextState,
      phase: "handOver",
      seats: newSeats,
      pot: 0,
      lastHandWinnerIndex: winner,
    };
  }
  const nextActor = nextActiveSeatIndex(nextState, seatIndex);
  return { ...nextState, currentActorIndex: nextActor };
}

export function check(state: TexasHoldemState, seatIndex: number): TexasHoldemState {
  if (state.phase !== "playing" || state.currentActorIndex !== seatIndex) return state;
  const seat = state.seats[seatIndex];
  if (seat.betThisHand < state.currentBet) return state;
  const seats = state.seats.map((s, i) =>
    i === seatIndex ? { ...s, actedThisRound: true } : s
  );
  const nextState = { ...state, seats };
  if (allActedThisRound(nextState)) {
    if (nextState.bettingPhase === "showdown") return doShowdown(nextState);
    return advanceBettingPhase(nextState);
  }
  const nextActor = nextActiveSeatIndex(nextState, seatIndex);
  return { ...nextState, currentActorIndex: nextActor };
}

export function call(state: TexasHoldemState, seatIndex: number): TexasHoldemState {
  if (state.phase !== "playing" || state.currentActorIndex !== seatIndex) return state;
  const seat = state.seats[seatIndex];
  const toCall = state.currentBet - seat.betThisHand;
  const amount = Math.min(toCall, seat.stack);
  const newStack = seat.stack - amount;
  const newBetThisHand = seat.betThisHand + amount;
  const seats = state.seats.map((s, i) =>
    i === seatIndex
      ? {
          ...s,
          stack: newStack,
          betThisHand: newBetThisHand,
          actedThisRound: true,
          isAllIn: newStack <= 0,
        }
      : s
  );
  const nextState = { ...state, seats };
  if (allActedThisRound(nextState)) {
    if (nextState.bettingPhase === "showdown") return doShowdown(nextState);
    return advanceBettingPhase(nextState);
  }
  const nextActor = nextActiveSeatIndex(nextState, seatIndex);
  return { ...nextState, currentActorIndex: nextActor };
}

export function raise(
  state: TexasHoldemState,
  seatIndex: number,
  amount: number
): TexasHoldemState {
  if (state.phase !== "playing" || state.currentActorIndex !== seatIndex) return state;
  const seat = state.seats[seatIndex];
  const minRaiseAmount = state.currentBet + state.minRaise;
  const totalToPut = Math.max(minRaiseAmount, state.currentBet + amount) - seat.betThisHand;
  const actual = Math.min(totalToPut, seat.stack);
  const newStack = seat.stack - actual;
  const newBetThisHand = seat.betThisHand + actual;
  const newCurrentBet = Math.max(state.currentBet, newBetThisHand);
  const seats = state.seats.map((s, i) =>
    i === seatIndex
      ? {
          ...s,
          stack: newStack,
          betThisHand: newBetThisHand,
          actedThisRound: true,
          isAllIn: newStack <= 0,
        }
      : { ...s, actedThisRound: false }
  );
  const nextState = {
    ...state,
    seats,
    currentBet: newCurrentBet,
    minRaise: Math.max(state.minRaise, newCurrentBet - state.currentBet),
  };
  if (allActedThisRound(nextState)) {
    if (nextState.bettingPhase === "showdown") return doShowdown(nextState);
    return advanceBettingPhase(nextState);
  }
  const nextActor = nextActiveSeatIndex(nextState, seatIndex);
  return { ...nextState, currentActorIndex: nextActor };
}

/** Startar nästa hand: samma spelare och stackar, ny giv, dealer flyttas. */
export function startNextHand(state: TexasHoldemState): TexasHoldemState {
  if (state.phase !== "handOver") return state;
  const stillInGame = state.seats.filter((s) => s.stack > 0).length;
  if (stillInGame < 2) {
    return { ...state, phase: "gameOver" };
  }
  const numPlayers = state.numPlayers;
  const dealerIndex = (state.dealerIndex + 1) % numPlayers;
  const sbIndex = nextSeatWithChips(state.seats, dealerIndex);
  const bbIndex = nextSeatWithChips(state.seats, sbIndex);
  const deck = shuffle(createDeck());
  const holeCards: Card[][] = [];
  for (let i = 0; i < numPlayers; i++) {
    if (state.seats[i].stack > 0) {
      holeCards.push([deck.pop()!, deck.pop()!]);
    } else {
      holeCards.push([]);
    }
  }
  const seats = state.seats.map((s, i) => {
    let stack = s.stack;
    let betThisHand = 0;
    let actedThisRound = false;
    const eliminated = stack <= 0;
    if (!eliminated && i === sbIndex) {
      const post = Math.min(state.smallBlind, stack);
      stack -= post;
      betThisHand = post;
      actedThisRound = true;
    } else if (!eliminated && i === bbIndex) {
      const post = Math.min(state.bigBlind, stack);
      stack -= post;
      betThisHand = post;
      actedThisRound = true;
    }
    return {
      ...s,
      stack,
      betThisHand,
      actedThisRound,
      folded: eliminated,
      isAllIn: stack <= 0,
    };
  });
  const pot = 0;
  const activeInHand = seats.map((_, i) => i).filter((i) => !seats[i].folded);
  const actorBase = bbIndex;
  const currentActorIndex = nextActiveSeatIndex(
    {
      ...state,
      seats,
      numPlayers,
      activeInHand,
    } as TexasHoldemState,
    actorBase
  );

  return {
    ...state,
    phase: "playing",
    seats,
    dealerIndex,
    currentActorIndex,
    bettingPhase: "preflop",
    board: [],
    holeCards,
    deck,
    pot,
    currentBet: state.bigBlind,
    minRaise: state.bigBlind,
    lastHandWinnerIndex: null,
    activeInHand,
  };
}
