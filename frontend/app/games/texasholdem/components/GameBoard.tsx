"use client";

import { useState } from "react";
import type { TexasHoldemState } from "../game-state";
import {
  fold,
  check,
  call,
  raise,
  startNextHand,
} from "../game-state";
import type { Card } from "../types";
import { bestHand, handRankLabel } from "../hand-rankings";
import { PlayingCard } from "./PlayingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function cardKey(c: Card): string {
  return `${c.suit}:${c.rank}`;
}

/** Klass för kort som ingår i vinnande handen: grön ram + lyft. */
const winningCardClass = "ring-2 ring-green-500 bg-green-500/20 -translate-y-2 shadow-md";

type GameBoardProps = {
  state: TexasHoldemState;
  onStateChange: (s: TexasHoldemState) => void;
};

const HUMAN_SEAT = 0;

export function GameBoard({ state, onStateChange }: GameBoardProps) {
  const isMyTurn =
    state.phase === "playing" && state.currentActorIndex === HUMAN_SEAT;
  const mySeat = state.seats[HUMAN_SEAT];
  const currentBet = state.currentBet;
  const toCall = mySeat ? currentBet - mySeat.betThisHand : 0;
  const minRaiseTotal = state.currentBet + state.minRaise;
  /** Stack <= att calla → endast All-in eller Fold. */
  const allInOrFoldOnly = mySeat && toCall > 0 && mySeat.stack <= toCall;
  const [raiseAmount, setRaiseAmount] = useState(minRaiseTotal);

  const handleFold = () => onStateChange(fold(state, HUMAN_SEAT));
  const handleCheck = () => onStateChange(check(state, HUMAN_SEAT));
  const handleCall = () => onStateChange(call(state, HUMAN_SEAT));
  const handleRaise = () => {
    const amount = Math.max(
      state.minRaise,
      raiseAmount - state.currentBet
    );
    onStateChange(raise(state, HUMAN_SEAT, amount));
  };
  const handleAllIn = () => {
    if (mySeat && mySeat.stack > 0) {
      onStateChange(raise(state, HUMAN_SEAT, mySeat.stack));
    }
  };
  const handleNextHand = () => onStateChange(startNextHand(state));

  if (state.phase === "setup") return null;

  if (state.phase === "gameOver") {
    const winner = state.seats.find((s) => s.stack > 0);
    return (
      <div className="mx-auto max-w-2xl space-y-6 text-center">
        <h2 className="text-xl font-semibold">Spelet är slut</h2>
        <p className="text-muted-foreground">
          Vinnare: {winner?.name ?? "—"} med {winner?.stack ?? 0} i stack.
        </p>
      </div>
    );
  }

  if (state.phase === "handOver") {
    const winnerIdx = state.lastHandWinnerIndex;
    const winnerName = winnerIdx != null ? state.seats[winnerIdx]?.name : "—";
    const winnerHoleCards = winnerIdx != null ? (state.holeCards[winnerIdx] ?? []) : [];
    const winnerHand =
      winnerIdx != null &&
      state.board.length === 5 &&
      winnerHoleCards.length === 2
        ? bestHand(winnerHoleCards, state.board)
        : null;
    const winningCardKeys = winnerHand
      ? new Set(winnerHand.cards.map(cardKey))
      : new Set<string>();

    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-semibold">Texas Hold&apos;em</h1>
          <span className="text-muted-foreground text-sm">Handen är slut</span>
        </div>

        {/* Längst upp: motståndare med kort (face up), vinnarens kort grönmarkerade */}
        <div className="flex flex-wrap justify-center gap-4">
          {state.seats.map((s, i) => {
            if (i === HUMAN_SEAT) return null;
            const holeCards = state.holeCards[i] ?? [];
            const wasInHand = !s.folded;
            const handRank =
              wasInHand && state.board.length === 5 && holeCards.length === 2
                ? bestHand(holeCards, state.board)
                : null;
            const isWinner = i === winnerIdx;
            return (
              <div
                key={s.id}
                className={cn(
                  "rounded-lg border bg-card p-3 min-w-[140px] text-center",
                  isWinner && "ring-2 ring-green-500 bg-green-500/10"
                )}
              >
                <p className="font-medium">
                  {s.name} {isWinner && "👑"}
                </p>
                <p className="text-muted-foreground text-xs">Stack: {s.stack}</p>
                {holeCards.length > 0 ? (
                  <div className="mt-2 flex justify-center gap-1">
                    {holeCards.map((c, j) => (
                      <PlayingCard
                        key={j}
                        card={c}
                        faceUp
                        size="sm"
                        className={winningCardKeys.has(cardKey(c)) ? winningCardClass : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-muted-foreground text-xs">—</p>
                )}
                {handRank && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {handRankLabel(handRank.rank)}
                  </p>
                )}
                {s.folded && (
                  <p className="mt-1 text-destructive text-xs">Folded</p>
                )}
              </div>
            );
          })}
        </div>

        {/* I mitten: bordet (kort som ingår i vinnande handen grönmarkerade och uppskjutna) + potten */}
        <div className="flex flex-col items-center gap-4 rounded-xl border bg-muted/30 py-6">
          <div className="flex flex-wrap justify-center gap-2 pt-4">
            {state.board.map((card, i) => (
              <PlayingCard
                key={i}
                card={card}
                size="md"
                className={winningCardKeys.has(cardKey(card)) ? winningCardClass : undefined}
              />
            ))}
          </div>
          <div className="rounded-full bg-amber-500/20 px-6 py-2 text-center">
            <p className="text-amber-800 dark:text-amber-200 text-sm font-medium">Pot (vunnet av {winnerName})</p>
          </div>
        </div>

        {/* Längst ner: jag + nästa hand (mina kort grönmarkerade om jag vann) */}
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-2 font-medium">{mySeat?.name} (Du)</p>
          <p className="text-muted-foreground text-sm">Stack: {mySeat?.stack ?? 0}</p>
          <div className="mt-3 flex justify-center gap-2">
            {(state.holeCards[HUMAN_SEAT] ?? []).map((card, i) => (
              <PlayingCard
                key={i}
                card={card}
                faceUp
                size="md"
                className={winningCardKeys.has(cardKey(card)) ? winningCardClass : undefined}
              />
            ))}
          </div>
          {mySeat && !mySeat.folded && state.board.length === 5 && state.holeCards[HUMAN_SEAT] && (
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Din hand: {handRankLabel(bestHand(state.holeCards[HUMAN_SEAT], state.board).rank)}
            </p>
          )}
          <div className="mt-4 text-center">
            <Button onClick={handleNextHand}>Nästa hand</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Texas Hold&apos;em</h1>
        <span className="text-muted-foreground text-sm">
          {state.bettingPhase === "preflop"
            ? "Preflop"
            : state.bettingPhase === "flop"
              ? "Flop"
              : state.bettingPhase === "turn"
                ? "Turn"
                : state.bettingPhase === "river"
                  ? "River"
                  : "Showdown"}
        </span>
      </div>

      {/* Längst upp: motståndare */}
      <div className="flex flex-wrap justify-center gap-4">
        {state.seats.map((s, i) => {
          if (i === HUMAN_SEAT) return null;
          const folded = s.folded;
          const holeCards = state.holeCards[i] ?? [];
          const opponentToCall = currentBet - s.betThisHand;
          const isTheirTurn = state.currentActorIndex === i;
          return (
            <div
              key={s.id}
              className={cn(
                "rounded-lg border bg-card p-3 min-w-[140px] text-center",
                isTheirTurn && "ring-2 ring-primary"
              )}
            >
              <p className="font-medium">{s.name}</p>
              <p className="text-muted-foreground text-xs">Stack: {s.stack}</p>
              <p className="text-xs font-medium text-foreground">
                {s.betThisHand > 0 ? `Betat denna hand: ${s.betThisHand}` : "Betat: 0"}
              </p>
              {isTheirTurn && !folded && (
                <p className="mt-1 text-primary text-xs font-medium">
                  {opponentToCall <= 0 ? "Kan checka" : `Måste betala ${opponentToCall} för att calla`}
                </p>
              )}
              {folded ? (
                <p className="mt-2 text-destructive text-sm">Folded</p>
              ) : (
                <div className="mt-2 flex justify-center gap-1">
                  {holeCards.map((c, j) => (
                    <PlayingCard
                      key={j}
                      card={c}
                      faceUp={state.phase === "handOver" || state.bettingPhase === "showdown"}
                      size="sm"
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* I mitten: utlagda kort + potten + nuvarande bet */}
      <div className="flex flex-col items-center gap-4 rounded-xl border bg-muted/30 py-6">
        <div className="flex flex-wrap justify-center gap-2">
          {state.board.map((card, i) => (
            <PlayingCard key={i} card={card} size="md" />
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6">
          <div className="rounded-full bg-amber-500/20 px-6 py-2 text-center">
            <p className="text-amber-800 dark:text-amber-200 text-sm font-medium">Pot</p>
            <p className="text-xl font-bold">{state.pot}</p>
          </div>
          <div className="rounded-full bg-muted px-4 py-2 text-center">
            <p className="text-muted-foreground text-xs">Nuvarande bet att matcha</p>
            <p className="text-lg font-semibold">{currentBet}</p>
          </div>
        </div>
      </div>

      {/* Längst ner: jag – mina kort, stack, bet, actions */}
      <div className="rounded-lg border bg-card p-4">
        <p className="mb-2 font-medium">{mySeat?.name} (Du)</p>
        <p className="text-muted-foreground text-sm">
          Stack: {mySeat?.stack ?? 0}
          {mySeat && mySeat.betThisHand > 0 && ` · Betat denna hand: ${mySeat.betThisHand}`}
        </p>
        {isMyTurn && mySeat && !mySeat.folded && (
          <p className="rounded-md bg-primary/10 px-3 py-1.5 text-center text-sm font-medium text-primary">
            {toCall <= 0 ? "Du kan checka" : `För att gå med: betala ${toCall}`}
          </p>
        )}
        <div className="mt-3 flex justify-center gap-2">
          {(state.holeCards[HUMAN_SEAT] ?? []).map((card, i) => (
            <PlayingCard key={i} card={card} size="md" />
          ))}
        </div>

        {isMyTurn && mySeat && !mySeat.folded && !mySeat.isAllIn && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button variant="destructive" size="sm" onClick={handleFold}>
              Fold
            </Button>
            {allInOrFoldOnly ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleAllIn}
                disabled={mySeat.stack <= 0}
              >
                All-in ({mySeat.stack})
              </Button>
            ) : (
              <>
                {toCall <= 0 ? (
                  <Button size="sm" onClick={handleCheck}>
                    Check
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleCall}>
                    Call {toCall}
                  </Button>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={minRaiseTotal}
                    max={(mySeat?.betThisHand ?? 0) + mySeat.stack}
                    value={raiseAmount}
                    onChange={(e) =>
                      setRaiseAmount(Number(e.target.value) || minRaiseTotal)
                    }
                    className="w-24"
                  />
                  <Button size="sm" onClick={handleRaise}>
                    {currentBet === 0 ? "Bet" : "Raise"} {raiseAmount}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleAllIn}
                    disabled={!mySeat || mySeat.stack <= 0}
                  >
                    All-in ({mySeat?.stack ?? 0})
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {state.phase === "playing" && !isMyTurn && (() => {
          const actingSeat = state.seats[state.currentActorIndex];
          const actingToCall = actingSeat ? currentBet - actingSeat.betThisHand : 0;
          return (
            <div className="mt-3 space-y-1 rounded-md border bg-muted/50 p-3 text-center text-sm">
              <p className="font-medium">Väntar på {actingSeat?.name}</p>
              <p className="text-muted-foreground">
                {actingToCall <= 0
                  ? "Motståndaren kan checka."
                  : `Motståndaren måste betala ${actingToCall} för att gå med (calla).`}
              </p>
            </div>
          );
        })()}

        {state.bettingPhase === "showdown" && state.board.length === 5 && mySeat && !mySeat.folded && state.holeCards[HUMAN_SEAT] && (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Din bästa hand: {handRankLabel(bestHand(state.holeCards[HUMAN_SEAT], state.board).rank)}
          </p>
        )}
      </div>
    </div>
  );
}
