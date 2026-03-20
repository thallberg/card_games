"use client";

import { useState } from "react";
import type { TexasHoldemState } from "../game-state";
import {
  fold,
  check,
  call,
  raise,
  startNextHand,
  createInitialSetupState,
  getTotalPot,
} from "../game-state";
import type { Card } from "../types";
import { bestHand, handRankLabel } from "../hand-rankings";
import { PlayingCard } from "@/components/playing-card";
import { PlayerInfoCard } from "@/components/player-info-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GameResultPanel } from "@/components/game/game-result-panel";
import { cn } from "@/lib/utils";

function cardKey(c: Card): string {
  return `${c.suit}:${c.rank}`;
}

/** Klass för kort som ingår i vinnande handen: grön ram + lyft. */
const winningCardClass = "ring-2 ring-green-500 bg-green-500/20 -translate-y-2 shadow-md";

type GameBoardProps = {
  state: TexasHoldemState;
  onStateChange: (s: TexasHoldemState) => void;
  /** Vilken seat som är "jag" (default 0). */
  humanSeatIndex?: number;
};

export function GameBoard({ state, onStateChange, humanSeatIndex = 0 }: GameBoardProps) {
  const humanSeat = humanSeatIndex;
  const isMyTurn =
    state.phase === "playing" && state.currentActorIndex === humanSeat;
  const mySeat = state.seats[humanSeat];
  const currentBet = state.currentBet;
  const toCall = mySeat ? currentBet - mySeat.betThisHand : 0;
  const minRaiseTotal = state.currentBet + state.minRaise;
  /** Stack <= att calla → endast All-in eller Fold. */
  const allInOrFoldOnly = mySeat && toCall > 0 && mySeat.stack <= toCall;
  const [raiseAmount, setRaiseAmount] = useState(minRaiseTotal);

  const handleFold = () => onStateChange(fold(state, humanSeat));
  const handleCheck = () => onStateChange(check(state, humanSeat));
  const handleCall = () => onStateChange(call(state, humanSeat));
  const handleRaise = () => {
    const amount = Math.max(
      state.minRaise,
      raiseAmount - state.currentBet
    );
    onStateChange(raise(state, humanSeat, amount));
  };
  const handleAllIn = () => {
    if (mySeat && mySeat.stack > 0) {
      onStateChange(raise(state, humanSeat, mySeat.stack));
    }
  };
  const handleNextHand = () => onStateChange(startNextHand(state));
  const handleRestartToSetup = () => onStateChange(createInitialSetupState());

  if (state.phase === "setup") return null;

  if (state.phase === "gameOver") {
    const winner = state.seats.find((s) => s.stack > 0);
    return (
      <div className="mx-auto max-w-2xl">
        <GameResultPanel
          title="Spelet är slut"
          message={`Vinnare: ${winner?.name ?? "—"} med ${winner?.stack ?? 0} i stack.`}
          actions={[{ label: "Starta om", onClick: handleRestartToSetup, variant: "outlinePrimary" }]}
        />
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
    const isHumanBusted = (state.seats[humanSeat]?.stack ?? 0) <= 0;

    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:gap-8 px-1 sm:px-0">
        {/* Längst upp: motståndare med kort (face up), vinnarens kort grönmarkerade */}
        <div className="flex flex-wrap justify-center gap-4">
          {state.seats.map((s, i) => {
            if (i === humanSeat) return null;
            const holeCards = state.holeCards[i] ?? [];
            const wasInHand = !s.folded;
            const handRank =
              wasInHand && state.board.length === 5 && holeCards.length === 2
                ? bestHand(holeCards, state.board)
                : null;
            const isWinner = i === winnerIdx;
            const isBusted = s.stack <= 0;
            return (
              <PlayerInfoCard
                key={s.id}
                name={
                  <>
                    {s.name} {isWinner && "👑"}
                  </>
                }
                subtitle={`Stack: ${s.stack}`}
                className={cn(
                  "text-center",
                  isWinner && "ring-2 ring-green-500 bg-green-500/10"
                )}
              >
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
                {isBusted && (
                  <p className="mt-1 text-destructive text-xs font-medium">
                    Utslagen - slut på pengar
                  </p>
                )}
              </PlayerInfoCard>
            );
          })}
        </div>

        {/* I mitten: bordet (kort som ingår i vinnande handen grönmarkerade och uppskjutna) + potten */}
        <div className="flex flex-col items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--warm-peach)]/40 py-6">
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
          <div className="rounded-full bg-[var(--warm-gold)]/30 px-6 py-2 text-center">
            <p className="text-[var(--foreground)] text-sm font-medium">Pot (vunnet av {winnerName})</p>
          </div>
        </div>

        {/* Längst ner: jag + nästa hand (mina kort grönmarkerade om jag vann) */}
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-2 font-medium">{mySeat?.name} (Du)</p>
          <p className="text-muted-foreground text-sm">Stack: {mySeat?.stack ?? 0}</p>
          {isHumanBusted && (
            <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
              Du har slut på pengar och förlorade.
            </p>
          )}
          <div className="mt-3 flex justify-center gap-2">
            {(state.holeCards[humanSeat] ?? []).map((card, i) => (
              <PlayingCard
                key={i}
                card={card}
                faceUp
                size="md"
                className={winningCardKeys.has(cardKey(card)) ? winningCardClass : undefined}
              />
            ))}
          </div>
          {mySeat && !mySeat.folded && state.board.length === 5 && state.holeCards[humanSeat] && (
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Din hand: {handRankLabel(bestHand(state.holeCards[humanSeat], state.board).rank)}
            </p>
          )}
          <div className="mt-4 text-center">
            {isHumanBusted ? (
              <Button variant="outlinePrimary" onClick={handleRestartToSetup}>Starta om</Button>
            ) : (
              <Button variant="outlinePrimary" onClick={handleNextHand}>Nästa hand</Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:gap-8 px-1 sm:px-0">
      {/* Längst upp: motståndare */}
      <div className="flex flex-wrap justify-center gap-4">
        {state.seats.map((s, i) => {
          if (i === humanSeat) return null;
          const folded = s.folded;
          const holeCards = state.holeCards[i] ?? [];
          const opponentToCall = currentBet - s.betThisHand;
          const isTheirTurn = state.currentActorIndex === i;
          return (
            <PlayerInfoCard
              key={s.id}
              isActive={isTheirTurn}
              name={s.name}
              subtitle={`Stack: ${s.stack}`}
              meta={s.betThisHand > 0 ? `Betat denna hand: ${s.betThisHand}` : "Betat: 0"}
              className={cn(
                "text-center",
                isTheirTurn && "ring-1 ring-primary"
              )}
            >
              <p
                className={cn(
                  "mt-0.5 min-h-6 text-[11px] leading-3 font-medium wrap-break-word",
                  isTheirTurn && !folded ? "text-primary" : "invisible"
                )}
                aria-hidden={!(isTheirTurn && !folded)}
              >
                {isTheirTurn && !folded
                  ? (opponentToCall <= 0 ? "Kan checka" : `Måste betala ${opponentToCall} för att calla`)
                  : "placeholder"}
              </p>
              {folded ? (
                <p className="mt-1 text-destructive text-sm">Folded</p>
              ) : (
                <div className="mt-1 flex justify-center gap-1">
                  {holeCards.map((c, j) => (
                    <PlayingCard
                      key={j}
                      card={c}
                      faceUp={state.phase === "handOver" || state.bettingPhase === "showdown"}
                      faceDownVariant="cardback"
                      size="sm"
                    />
                  ))}
                </div>
              )}
            </PlayerInfoCard>
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
        <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <span>Pot {getTotalPot(state)}</span>
          <span>Bet att matcha {currentBet}</span>
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
          {(state.holeCards[humanSeat] ?? []).map((card, i) => (
            <PlayingCard key={i} card={card} size="md" />
          ))}
        </div>

        {isMyTurn && mySeat && !mySeat.folded && !mySeat.isAllIn && (
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex w-full gap-2">
              <Button variant="outlineDestructive" size="sm" onClick={handleFold} className="flex-1 min-h-11">
                Fold
              </Button>
              {allInOrFoldOnly ? (
                  <Button
                    size="sm"
                    variant="outlineSecondary"
                    onClick={handleAllIn}
                    disabled={mySeat.stack <= 0}
                    className="flex-1 min-h-11"
                  >
                    All-in ({mySeat.stack})
                  </Button>
              ) : (
                <>
                  {toCall <= 0 ? (
                    <Button size="sm" variant="outlinePrimary" onClick={handleCheck} className="flex-1 min-h-11">
                      Check
                    </Button>
                  ) : (
                    <Button size="sm" variant="outlinePrimary" onClick={handleCall} className="flex-1 min-h-11">
                      Call {toCall}
                    </Button>
                  )}
                </>
              )}
            </div>
            {!allInOrFoldOnly && (
              <>
                <Input
                  type="number"
                  min={minRaiseTotal}
                  max={(mySeat?.betThisHand ?? 0) + mySeat.stack}
                  value={raiseAmount}
                  onChange={(e) =>
                    setRaiseAmount(Number(e.target.value) || minRaiseTotal)
                  }
                  className="w-full min-h-11"
                />
                <div className="flex w-full gap-2">
                  <Button size="sm" variant="outlinePrimary" onClick={handleRaise} className="flex-1 min-h-11">
                    {currentBet === 0 ? "Bet" : "Raise"} {raiseAmount}
                  </Button>
                  <Button
                    size="sm"
                    variant="outlineSecondary"
                    onClick={handleAllIn}
                    disabled={!mySeat || mySeat.stack <= 0}
                    className="flex-1 min-h-11"
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
            <div className="mt-3 space-y-1 rounded-md border border-[var(--border)] bg-[var(--warm-sand)]/50 p-3 text-center text-sm">
              <p className="font-medium">Väntar på {actingSeat?.name}</p>
              <p className="text-muted-foreground">
                {actingToCall <= 0
                  ? "Motståndaren kan checka."
                  : `Motståndaren måste betala ${actingToCall} för att gå med (calla).`}
              </p>
            </div>
          );
        })()}

        {state.bettingPhase === "showdown" && state.board.length === 5 && mySeat && !mySeat.folded && state.holeCards[humanSeat] && (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Din bästa hand: {handRankLabel(bestHand(state.holeCards[humanSeat], state.board).rank)}
          </p>
        )}
      </div>
    </div>
  );
}
