"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  createInitialSetupState,
  startNewGame,
  fold,
  check,
  call,
  raise,
  type TexasHoldemState,
} from "./game-state";
import { fetchTexasHoldemState, sendTexasHoldemAction } from "./api/texasHoldemApi";
import { SetupForm, GameBoard } from "./components";

const POLL_MS = 2500;

function parseState(data: unknown): TexasHoldemState | null {
  if (data == null || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  return {
    phase: (o.phase as TexasHoldemState["phase"]) ?? "setup",
    seats: Array.isArray(o.seats) ? (o.seats as TexasHoldemState["seats"]) : [],
    numPlayers: Number(o.numPlayers) ?? 2,
    buyIn: Number(o.buyIn) ?? 2000,
    bigBlind: Number(o.bigBlind) ?? 20,
    smallBlind: Number(o.smallBlind) ?? 10,
    dealerIndex: Number(o.dealerIndex) ?? 0,
    currentActorIndex: Number(o.currentActorIndex) ?? 0,
    bettingPhase: (o.bettingPhase as TexasHoldemState["bettingPhase"]) ?? "preflop",
    board: Array.isArray(o.board) ? (o.board as TexasHoldemState["board"]) : [],
    holeCards: Array.isArray(o.holeCards) ? (o.holeCards as TexasHoldemState["holeCards"]) : [],
    deck: Array.isArray(o.deck) ? (o.deck as TexasHoldemState["deck"]) : [],
    pot: Number(o.pot) ?? 0,
    currentBet: Number(o.currentBet) ?? 0,
    minRaise: Number(o.minRaise) ?? 20,
    lastHandWinnerIndex: typeof o.lastHandWinnerIndex === "number" ? o.lastHandWinnerIndex : null,
    activeInHand: Array.isArray(o.activeInHand) ? (o.activeInHand as number[]) : [],
  };
}

export function TexasHoldemClient() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") ?? undefined;

  const [state, setState] = useState<TexasHoldemState>(() =>
    createInitialSetupState() as TexasHoldemState
  );
  const [mySeatIndex, setMySeatIndex] = useState(0);
  const [multiplayerLoading, setMultiplayerLoading] = useState(!!sessionId);
  const [multiplayerError, setMultiplayerError] = useState<string | null>(null);
  const [waitingForStart, setWaitingForStart] = useState(false);

  const isMultiplayer = !!sessionId;
  const isHumanTurn =
    state.phase === "playing" && state.currentActorIndex === mySeatIndex;
  const aiDelay = 800;

  const loadMultiplayerState = useCallback(async () => {
    if (!sessionId) return;
    const result = await fetchTexasHoldemState(sessionId);
    if (result) {
      setWaitingForStart(!!result.waitingForStart);
      if (result.waitingForStart) {
        setMultiplayerError(null);
      } else {
        const parsed = parseState(result.state);
        if (parsed) {
          setState(parsed);
          setMySeatIndex(result.mySeatIndex);
        }
        setMultiplayerError(null);
      }
    } else {
      setMultiplayerError("Kunde inte ladda spelet.");
      setWaitingForStart(false);
    }
    setMultiplayerLoading(false);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    loadMultiplayerState();
  }, [sessionId, loadMultiplayerState]);

  useEffect(() => {
    if (!sessionId || state.phase === "setup" || state.phase === "gameOver") return;
    const t = setInterval(loadMultiplayerState, POLL_MS);
    return () => clearInterval(t);
  }, [sessionId, state.phase, loadMultiplayerState]);

  const performAiAction = useCallback(() => {
    if (state.phase !== "playing" || state.currentActorIndex === mySeatIndex) return;
    const seatIdx = state.currentActorIndex;
    const seat = state.seats[seatIdx];
    if (!seat || seat.folded || seat.isAllIn) return;

    const toCall = state.currentBet - seat.betThisHand;
    const canCheck = toCall <= 0;

    if (Math.random() < 0.15 && toCall > 0) {
      setState(fold(state, seatIdx));
      return;
    }
    if (canCheck) {
      setState(check(state, seatIdx));
      return;
    }
    if (toCall > 0 && seat.stack <= toCall) {
      setState(call(state, seatIdx));
      return;
    }
    if (Math.random() < 0.3 && seat.stack > state.minRaise) {
      const raiseBy = state.minRaise + Math.floor(Math.random() * state.bigBlind * 2);
      setState(raise(state, seatIdx, raiseBy));
      return;
    }
    setState(call(state, seatIdx));
  }, [state, mySeatIndex]);

  useEffect(() => {
    if (!isMultiplayer && !isHumanTurn && state.phase === "playing") {
      const t = setTimeout(performAiAction, aiDelay);
      return () => clearTimeout(t);
    }
  }, [isMultiplayer, isHumanTurn, state.phase, state.currentActorIndex, performAiAction]);

  const handleStart = (numPlayers: number, buyIn: number, bigBlind: number) => {
    setState(startNewGame(numPlayers, buyIn, bigBlind));
  };

  const handleStateChange = useCallback(
    async (newState: TexasHoldemState) => {
      setState(newState);
      if (isMultiplayer && sessionId) {
        const result = await sendTexasHoldemAction(
          sessionId,
          "saveState",
          JSON.stringify(newState)
        );
        if (result.ok && result.state != null) {
          const parsed = parseState(result.state);
          if (parsed) setState(parsed);
        }
      }
    },
    [isMultiplayer, sessionId]
  );

  if (isMultiplayer && multiplayerLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground">Laddar Texas Hold&apos;em...</p>
      </div>
    );
  }

  if (isMultiplayer && multiplayerError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-destructive">{multiplayerError}</p>
      </div>
    );
  }

  if (isMultiplayer && (state.phase === "setup" || waitingForStart)) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-muted-foreground">
          Väntar på att partyleadern startar spelet...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isMultiplayer && state.phase === "setup" ? (
        <SetupForm onStart={handleStart} />
      ) : (
        <GameBoard
          state={state}
          onStateChange={handleStateChange}
          humanSeatIndex={mySeatIndex}
        />
      )}
    </div>
  );
}
