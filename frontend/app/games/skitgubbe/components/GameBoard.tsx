"use client";

import { useSkitgubbeGame } from "../hooks/useSkitgubbeGame";
import { PlayingCard } from "./PlayingCard";
import { StockPile } from "./StockPile";
import { WonPile } from "./WonPile";
import { Button } from "@/components/ui/button";
import { MIN_PLAYERS, MAX_PLAYERS } from "../constants";

const SUIT_LABELS: Record<string, string> = {
  hearts: "hjärter",
  diamonds: "ruter",
  clubs: "klöver",
  spades: "spader",
};

export function GameBoard() {
  const {
    state,
    playerCount,
    humanHand,
    isHumanTurn,
    playableStickIndices,
    playableTrickIndices,
    selectedTrickIndices,
    isTrickSelectionValid,
    confirmTrickPlay,
    canDrawAndPlay,
    canPickUpTrick,
    startGame,
    playCardFromHand,
    drawAndPlay,
    continueToPlay,
    playTrickCard,
    pickUpTrick,
    resetGame,
    getPlayerIds,
    getSkitgubbePreview,
  } = useSkitgubbeGame();

  if (playerCount === null) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 px-1 sm:px-0">
        <h1 className="text-lg sm:text-xl font-semibold">Skitgubbe</h1>
        <p className="text-muted-foreground text-sm">
          Välj antal spelare (2–6). Du spelar som spelare 1, övriga är datorer.
        </p>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => i + MIN_PLAYERS).map(
            (n) => (
              <Button key={n} onClick={() => startGame(n)}>
                {n} spelare
              </Button>
            )
          )}
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground">Laddar Skitgubbe…</p>
      </div>
    );
  }

  if (state.phase === "skitgubbe") {
    const skitgubbeId = getSkitgubbePreview?.() ?? null;
    return (
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 px-1 sm:px-0">
        <h1 className="text-lg sm:text-xl font-semibold">Skitgubbe – Trumf</h1>
        <section className="rounded-lg border border-[var(--border)] bg-[var(--warm-peach)]/30 p-4">
          {state.lastRevealedCard && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-muted-foreground">
                Sista kortet var {state.lastRevealedCard.rank}{" "}
                {SUIT_LABELS[state.lastRevealedCard.suit]}. Trumf är{" "}
                {SUIT_LABELS[state.trumpSuit ?? ""]}.
              </p>
              <PlayingCard card={state.lastRevealedCard} faceUp />
              {skitgubbeId && (
                <p className="text-muted-foreground text-sm">
                  {skitgubbeId === "p1" ? "Du" : "Spelare " + skitgubbeId} har bara kort under trumf
                  – får 2–5 och trumf 6 från andra.
                </p>
              )}
              <Button onClick={continueToPlay}>Fortsätt till utspelet</Button>
            </div>
          )}
        </section>
      </div>
    );
  }

  if (state.phase === "gameOver") {
    return (
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 px-1 sm:px-0">
        <h1 className="text-lg sm:text-xl font-semibold">Skitgubbe</h1>
        <section className="rounded-lg border border-[var(--border)] bg-[var(--warm-peach)]/50 p-6 text-center">
          <p className="font-medium">
            {state.winnerId === "p1" ? "Du" : "Spelare " + state.winnerId} vann!
          </p>
          <Button onClick={resetGame} className="mt-4">
            Spela igen
          </Button>
        </section>
      </div>
    );
  }

  const isSticks = state.phase === "sticks";
  const playableIndices = isSticks ? playableStickIndices : playableTrickIndices;

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 px-1 sm:px-0">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        <h1 className="text-lg sm:text-xl font-semibold">Skitgubbe</h1>
        <div className="flex gap-4 sm:gap-6 text-xs sm:text-sm">
          {getPlayerIds().map((id) => (
            <div key={id} className="flex flex-col gap-0.5">
              <span className="font-medium">{id === "p1" ? "Du" : "Spelare " + id}</span>
              <span className="text-muted-foreground">
                {isSticks ? `Stick: ${state.sticksWon[id] ?? 0}` : `${state.playerHands[id]?.length ?? 0} kort`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {state.lastRevealedCard && state.phase === "sticks" && (
        <p className="text-muted-foreground text-sm">
          Sista kortet (trumf): {state.lastRevealedCard.rank} {SUIT_LABELS[state.lastRevealedCard.suit]}
        </p>
      )}

      {isSticks && (
        <>
          <div className="flex flex-wrap items-end justify-center gap-4 sm:gap-6">
            <StockPile
              count={state.stock.length}
              onDraw={canDrawAndPlay ? drawAndPlay : undefined}
              disabled={!canDrawAndPlay}
            />
            {getPlayerIds().map((id) => (
              <WonPile
                key={id}
                count={(state.wonCards ?? {})[id]?.length ?? 0}
                label={id === "p1" ? "Mina kort" : `Spelare ${id}`}
              />
            ))}
          </div>
          <section className="rounded-lg border border-[var(--border)] bg-[var(--warm-sand)]/40 p-3 sm:p-4">
            <h2 className="mb-2 text-sm font-medium">Fas 1 – Stick</h2>
          {state.tableStick.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {state.tableStick.map((sc, i) => (
                <div key={i} className="flex flex-col items-center">
                  <PlayingCard card={sc.card} faceUp />
                  <span className="text-xs text-muted-foreground">
                    {sc.playerId === "p1" ? "Du" : sc.playerId}
                  </span>
                </div>
              ))}
            </div>
          )}
          {state.stickShowingWinner && (
            <p className="text-sm font-medium text-primary mb-2">
              {state.stickShowingWinner === "p1" ? "Du" : "Spelare " + state.stickShowingWinner} vann sticket!
            </p>
          )}
          {!isHumanTurn && !state.stickShowingWinner && (
            <p className="text-muted-foreground text-sm">Andra spelares tur…</p>
          )}
          </section>
        </>
      )}

      {state.phase === "play" && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--warm-sand)]/40 p-3 sm:p-4">
          <h2 className="mb-2 text-sm font-medium">Fas 2 – Utspelet</h2>
          {state.trumpSuit && (
            <p className="text-muted-foreground text-xs mb-2">Trumf: {SUIT_LABELS[state.trumpSuit]}</p>
          )}
          {state.tableTrick.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {state.tableTrick.map((tc, i) => (
                <div key={i} className="flex flex-col items-center">
                  <PlayingCard card={tc.card} faceUp />
                  <span className="text-xs text-muted-foreground">
                    {tc.playerId === "p1" ? "Du" : tc.playerId}
                  </span>
                </div>
              ))}
            </div>
          )}
          {state.trickShowingWinner && (
            <p className="text-sm font-medium text-primary mb-2">
              {state.trickShowingWinner === "p1" ? "Du" : "Spelare " + state.trickShowingWinner} vann sticket!
            </p>
          )}
          {!isHumanTurn && !state.trickShowingWinner && (
            <p className="text-muted-foreground text-sm">Andra spelares tur…</p>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Din hand
          {isHumanTurn &&
            (isSticks
              ? " – välj ett kort att lägga, eller plocka från högen"
              : " – markera kort (enkort eller stege), klicka Lägg ut för att spela")}
        </h2>
        <div
          className={
            state.phase === "play"
              ? "flex flex-wrap gap-2 overflow-x-auto overflow-y-visible pb-2 min-h-[90px]"
              : "flex flex-wrap gap-2"
          }
        >
          {humanHand.map((card, i) => {
            const canPlay = playableIndices.has(i);
            const isPlayPhase = state.phase === "play";
            const isSelected = isPlayPhase && selectedTrickIndices?.has(i);
            const onClick =
              isSticks
                ? isHumanTurn && canPlay
                  ? () => playCardFromHand(i)
                  : undefined
                : isHumanTurn && !state.trickShowingWinner
                  ? () => playTrickCard(i)
                  : undefined;
            const dimmed =
              isSticks && isHumanTurn && !canPlay
                ? true
                : isPlayPhase && isHumanTurn
                  ? false
                  : isHumanTurn && !canPlay;
            return (
              <PlayingCard
                key={`${card.suit}-${card.rank}-${i}`}
                card={card}
                faceUp
                dimmed={dimmed}
                selected={isSelected}
                onClick={onClick}
              />
            );
          })}
        </div>
        {isSticks && isHumanTurn && canDrawAndPlay && (
          <Button variant="outline" onClick={drawAndPlay} className="mt-3">
            Plocka från högen och lägg ut
          </Button>
        )}
        {state.phase === "play" && isHumanTurn && isTrickSelectionValid && (
          <Button onClick={confirmTrickPlay} className="mt-3">
            Lägg ut
          </Button>
        )}
        {state.phase === "play" && isHumanTurn && canPickUpTrick && (
          <Button variant="outline" onClick={pickUpTrick} className="mt-3">
            Plocka sticket
          </Button>
        )}
      </section>

    </div>
  );
}
