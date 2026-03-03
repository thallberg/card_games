"use client";

import { useState, useEffect, useCallback } from "react";
import {
  createInitialSetupState,
  startNewGame,
  fold,
  check,
  call,
  raise,
  type TexasHoldemState,
} from "./game-state";
import { SetupForm, GameBoard } from "./components";

export function TexasHoldemClient() {
  const [state, setState] = useState<TexasHoldemState>(() =>
    createInitialSetupState() as TexasHoldemState
  );

  const isHumanTurn =
    state.phase === "playing" && state.currentActorIndex === 0;
  const aiDelay = 800;

  const performAiAction = useCallback(() => {
    if (state.phase !== "playing" || state.currentActorIndex === 0) return;
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
  }, [state]);

  useEffect(() => {
    if (!isHumanTurn && state.phase === "playing") {
      const t = setTimeout(performAiAction, aiDelay);
      return () => clearTimeout(t);
    }
  }, [isHumanTurn, state.phase, state.currentActorIndex, performAiAction]);

  const handleStart = (numPlayers: number, buyIn: number, bigBlind: number) => {
    setState(startNewGame(numPlayers, buyIn, bigBlind));
  };

  return (
    <div className="space-y-6">
      {state.phase === "setup" ? (
        <SetupForm onStart={handleStart} />
      ) : (
        <GameBoard state={state} onStateChange={setState} />
      )}
    </div>
  );
}
