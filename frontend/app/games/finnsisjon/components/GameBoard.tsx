"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useFinnsisjonGame } from "../hooks/useFinnsisjonGame";
import { useFinnsisjonGameMultiplayer } from "../hooks/useFinnsisjonGameMultiplayer";
import { PlayingCard } from "@/components/playing-card";
import { Button } from "@/components/ui/button";
import { SinglePlayerIntro } from "@/components/single-player-intro";
import { Spinner } from "@/components/ui/spinner";
import { RANK_LABELS } from "../types";
import type { PlayerId, Rank } from "../types";
import type { Card } from "../types";
import { MIN_PLAYERS, MAX_PLAYERS, CARDS_PER_QUARTET } from "../constants";

const RANK_ORDER: Record<string, number> = {
  "2": 0, "3": 1, "4": 2, "5": 3, "6": 4, "7": 5, "8": 6, "9": 7,
  "10": 8, jack: 9, queen: 10, king: 11, ace: 12,
};

function sortHandByRank(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
}

type GameBoardProps = { sessionId?: string };

export function GameBoard({ sessionId }: GameBoardProps) {
  const single = useFinnsisjonGame();
  const multi = useFinnsisjonGameMultiplayer(sessionId);
  const useMulti = !!sessionId;

  const {
    state,
    playerCount,
    humanHand,
    isHumanTurn,
    canAsk,
    mustDrawFromSjön,
    pendingAskFromAI,
    pendingAiDrawStep,
    lastAiAskWasFinnsISjon,
    startGame,
    resetGame,
    askForRank,
    drawCardFromSjön,
    getPlayerIds,
  } = useMulti ? multi : single;

  const myPlayerId = useMulti ? (multi.myPlayerId ?? "p1") : "p1";
  const playerDisplayNames = useMulti ? (multi.playerDisplayNames ?? {}) : {};
  const loading = useMulti && multi.loading;
  const waitingForStart = useMulti && multi.waitingForStart;

  const [selectedRank, setSelectedRank] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerId | null>(null);

  const toggleRank = (rank: string) => {
    setSelectedRank((r) => (r === rank ? null : rank));
  };

  const opponentIds = getPlayerIds().filter((id) => id !== myPlayerId);
  const opponentIdsStr: string[] = opponentIds;
  useEffect(() => {
    if (canAsk && opponentIdsStr.length > 0 && (selectedPlayer === null || !opponentIdsStr.includes(selectedPlayer))) {
      setSelectedPlayer(opponentIds[0] ?? null);
    }
  }, [canAsk, opponentIds, selectedPlayer]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] flex-1 items-center justify-center">
        <Spinner size="xl" className="text-primary" />
      </div>
    );
  }

  if (waitingForStart) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-1 sm:px-0">
        <p className="text-muted-foreground">Väntar på att ledaren startar spelet…</p>
        <p className="text-muted-foreground text-sm">
          Spelet startar när partiledaren klickar &quot;Starta spelet&quot; i Mina spel.
        </p>
        <Button asChild variant="outline">
          <Link href="/spel">Gå till Mina spel</Link>
        </Button>
      </div>
    );
  }

  if (playerCount === null && !useMulti) {
    return (
      <SinglePlayerIntro
        title="Finns i sjön – single player"
        description="Välj antal spelare (2–6). Du spelar som spelare 1, övriga är datorer. Fråga efter valör du har – får du inte kortet säger motståndaren 'finns i sjön' och du drar ett kort från sjön. Vinnaren är den med flest kvartetter när alla kort är slut."
        minPlayers={MIN_PLAYERS}
        maxPlayers={MAX_PLAYERS}
        onSelect={startGame}
      />
    );
  }

  if (!state) {
    const loadFailed = useMulti && !loading && !waitingForStart;
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-center">Kunde inte ladda spelet.</p>
        {loadFailed && multi.loadState ? (
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => multi.loadState?.()}>
              Försök igen
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/spel">Mina spel</Link>
            </Button>
          </div>
        ) : useMulti ? (
          <>
            <p className="text-muted-foreground text-sm text-center">
              Kontrollera att partiledaren har klickat &quot;Starta spelet&quot; i Mina spel.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/spel">Mina spel</Link>
            </Button>
          </>
        ) : null}
      </div>
    );
  }

  const playerLabel = (id: string) =>
    id === myPlayerId ? "Du" : (playerDisplayNames[id] ?? `Spelare ${id}`);

  if (state.phase === "gameOver") {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-1 sm:px-0">
        <section className="rounded-lg border border-border bg-[var(--warm-peach)]/50 p-6 text-center">
          <h2 className="text-lg font-semibold">Spelet är slut</h2>
          <p className="mt-2 text-muted-foreground">
            {state.winnerId
              ? `${playerLabel(state.winnerId)} vann med ${state.quartetsWon[state.winnerId] ?? 0} kvartetter!`
              : "Oavgjort!"}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
            {getPlayerIds().map((id) => (
              <span key={id} className="text-muted-foreground">
                {playerLabel(id)}: {state.quartetsWon[id] ?? 0} kvartetter
              </span>
            ))}
          </div>
          {!useMulti && (
            <Button variant="outlinePrimary" onClick={resetGame} className="mt-6">
              Spela igen
            </Button>
          )}
        </section>
      </div>
    );
  }

  const handleAsk = () => {
    if (selectedRank && selectedPlayer && canAsk) {
      askForRank(selectedPlayer as PlayerId, selectedRank as Rank);
      setSelectedRank(null);
      setSelectedPlayer(null);
    }
  };

  const myQuartetCount = state.quartetsWon[myPlayerId] ?? 0;

  const currentTurnId = state.currentPlayerId;

  return (
    <div className="mx-auto max-w-4xl space-y-3 sm:space-y-4 px-1 sm:px-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold">Finns i sjön</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Turordning: {getPlayerIds().map((id) => playerLabel(id)).join(" → ")}. Nu: {currentTurnId === myPlayerId ? "din tur" : `${playerLabel(currentTurnId)}s tur`}
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-muted-foreground">
          {getPlayerIds().map((id) => (
            <span key={id}>
              {playerLabel(id)}: {state.quartetsWon[id] ?? 0} kvartetter, {state.playerHands[id]?.length ?? 0} kort
            </span>
          ))}
        </div>
      </div>

      {/* 1. Motståndarens kort (längst upp) – en hög per motståndare, sektioner bredvid varandra */}
      <div className="flex flex-wrap gap-3 sm:gap-4">
        {opponentIds.map((id) => {
          const count = state.playerHands[id]?.length ?? 0;
          const isAskingMe = pendingAskFromAI?.from === id;
          const lastAskFromThisToMe = state.lastAsk?.from === id && state.lastAsk?.to === myPlayerId;
          const lastAskFromThisToOtherAi = state.lastAsk?.from === id && state.lastAsk?.to !== myPlayerId && state.lastWasFinnsISjon;
          const showAiVsAiStep = lastAskFromThisToOtherAi && state.lastAsk;
          const isThisPlayerTurn = currentTurnId === id;
          const rankLabel = (r: string) => RANK_LABELS[r] ?? r;
          return (
            <section
              key={id}
              className={`rounded-lg border p-2 sm:p-3 shrink-0 ${isThisPlayerTurn ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border bg-muted/30"}`}
            >
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                {playerLabel(id)} · {count} kort
                {isThisPlayerTurn && <span className="ml-1.5 text-primary font-semibold">(tur)</span>}
              </h2>
              <div className="relative min-h-[92px] sm:min-h-[108px] w-[50px] sm:w-[62px] shrink-0">
                {Array.from({ length: count }, (_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 top-0"
                    style={{ transform: `translate(0, ${i * 6}px)` }}
                  >
                    <PlayingCard
                      card={state.playerHands[id]?.[i] ?? { suit: "hearts", rank: "2" }}
                      faceUp={false}
                      faceDownVariant="cardback"
                      size="sm"
                    />
                  </div>
                ))}
              </div>
              {isAskingMe && pendingAskFromAI && (
                <p className="mt-2 rounded-md bg-amber-500/15 px-2 py-1.5 text-sm text-amber-800 dark:text-amber-200 max-w-[180px]">
                  {playerLabel(id)} frågar efter {rankLabel(pendingAskFromAI.rank)}…
                </p>
              )}
              {!isAskingMe && lastAskFromThisToMe && state.lastAsk && (
                <p className="mt-2 rounded-md bg-muted/80 px-2 py-1.5 text-sm text-muted-foreground max-w-[200px]">
                  {state.lastWasFinnsISjon || lastAiAskWasFinnsISjon ? (
                    <>
                      {playerLabel(id)} frågade efter {rankLabel(state.lastAsk.rank)}. {rankLabel(state.lastAsk.rank)} finns i sjön. {playerLabel(id)} plockade ett kort ur sjön.
                    </>
                  ) : (
                    <>
                      {playerLabel(id)} fick en {rankLabel(state.lastAsk.rank)} av dig…
                    </>
                  )}
                </p>
              )}
              {!isAskingMe && showAiVsAiStep && (
                <p className="mt-2 rounded-md bg-muted/80 px-2 py-1.5 text-sm text-muted-foreground max-w-[200px]">
                  {pendingAiDrawStep === 0 && (
                    <>{playerLabel(id)} frågade {playerLabel(state.lastAsk!.to)} efter {rankLabel(state.lastAsk!.rank)}</>
                  )}
                  {pendingAiDrawStep === 1 && (
                    <>{rankLabel(state.lastAsk!.rank)} finns i sjön</>
                  )}
                  {pendingAiDrawStep === 2 && (
                    <>{playerLabel(id)} plockade ett kort ur sjön.</>
                  )}
                </p>
              )}
            </section>
          );
        })}
      </div>

      {/* 2. Motståndarens utlagda kort (kvartetter) – baksida, en hög per kvartett */}
      {opponentIds.map((id) => {
        const q = state.quartetsWon[id] ?? 0;
        if (q === 0) return null;
        return (
          <section key={`out-${id}`} className="rounded-lg border border-border bg-muted/20 p-2 sm:p-3">
            <h2 className="mb-2 text-xs font-medium text-muted-foreground">
              {playerLabel(id)} utlagda ({q} kvartett{q !== 1 ? "er" : ""})
            </h2>
            <div className="flex gap-2">
              {Array.from({ length: q }, (_, pileIdx) => (
                <div key={pileIdx} className="relative min-h-[90px] w-[50px] sm:min-h-[94px] sm:w-[62px] shrink-0">
                  {Array.from({ length: CARDS_PER_QUARTET }, (_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 top-0"
                      style={{ transform: `translate(0, ${i * 6}px)` }}
                    >
                      <PlayingCard
                        card={{ suit: "hearts", rank: "2" }}
                        faceUp={false}
                        faceDownVariant="cardback"
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* 3. Sjön – alla kvarvarande kort, baksida; scroll, klicka för att plocka */}
      <section className="rounded-lg border border-border bg-[var(--pastel-sky)]/40 p-3 sm:p-4">
        <h2 className="mb-2 text-sm font-medium">
          Sjön
          {state.sjön.length > 0 && (
            <span className="ml-2 text-muted-foreground font-normal">({state.sjön.length} kort)</span>
          )}
        </h2>
        {mustDrawFromSjön && (
          <p className="mb-2 text-sm text-amber-800 dark:text-amber-200">
            Klicka på ett kort för att plocka upp det.
          </p>
        )}
        <div className="flex max-h-[200px] flex-wrap content-start gap-2 overflow-y-auto overflow-x-hidden rounded-md border border-border/60 bg-background/50 p-2 sm:max-h-[240px]">
          {state.sjön.length === 0 ? (
            <p className="py-4 text-muted-foreground text-sm">Inga kort kvar i sjön.</p>
          ) : (
            state.sjön.map((card, index) => (
              <div key={`sjön-${index}`} className="shrink-0">
                <PlayingCard
                  card={card}
                  faceUp={false}
                  faceDownVariant="cardback"
                  size="sm"
                  onClick={
                    mustDrawFromSjön
                      ? () => drawCardFromSjön(index)
                      : undefined
                  }
                  className={mustDrawFromSjön ? "cursor-pointer ring-2 ring-offset-2 hover:ring-primary" : ""}
                />
              </div>
            ))
          )}
        </div>
      </section>

      {/* 4. Mina utlagda (kvartetter) – baksida, en hög per kvartett */}
      {myQuartetCount > 0 && (
        <section className="rounded-lg border border-border bg-muted/20 p-2 sm:p-3">
          <h2 className="mb-2 text-xs font-medium text-muted-foreground">
            Mina utlagda ({myQuartetCount} kvartett{myQuartetCount !== 1 ? "er" : ""})
          </h2>
          <div className="flex gap-2">
            {Array.from({ length: myQuartetCount }, (_, pileIdx) => (
              <div key={pileIdx} className="relative min-h-[90px] w-[50px] sm:min-h-[94px] sm:w-[62px] shrink-0">
                {Array.from({ length: CARDS_PER_QUARTET }, (_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 top-0"
                    style={{ transform: `translate(0, ${i * 6}px)` }}
                  >
                    <PlayingCard
                      card={{ suit: "hearts", rank: "2" }}
                      faceUp={false}
                      faceDownVariant="cardback"
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {state.lastAsk && state.lastAsk.from === myPlayerId && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm">
          {state.lastWasFinnsISjon ? (
            <p className="font-medium text-amber-800 dark:text-amber-200">
              {playerLabel(state.lastAsk.to)} hade inte {RANK_LABELS[state.lastAsk.rank] ?? state.lastAsk.rank} – finns i sjön!
            </p>
          ) : (
            <p className="text-muted-foreground">
              Du frågade {playerLabel(state.lastAsk.to)} om {RANK_LABELS[state.lastAsk.rank] ?? state.lastAsk.rank} och fick kort.
            </p>
          )}
        </div>
      )}

      {/* 5. Mina kort / Din hand (längst ner) – framsida; klicka på kort för att välja valör */}
      <section
        className={`rounded-lg border p-3 sm:p-4 ${currentTurnId === myPlayerId ? "border-primary bg-[var(--warm-sand)]/50 ring-1 ring-primary/30" : "border-border bg-[var(--warm-sand)]/30"}`}
      >
        <h2 className="mb-2 text-sm font-medium">
          Mina kort
          {currentTurnId === myPlayerId && <span className="ml-1.5 text-primary font-semibold">(din tur)</span>}
        </h2>
        {canAsk && (
          <p className="mb-2 text-xs text-muted-foreground">
            Klicka på ett kort för att fråga efter den valören.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {sortHandByRank(humanHand).map((card, i) => (
            <PlayingCard
              key={`hand-${card.suit}-${card.rank}-${i}`}
              card={card}
              faceUp
              selected={canAsk && selectedRank === card.rank}
              onClick={canAsk ? () => toggleRank(card.rank) : undefined}
            />
          ))}
        </div>

        {canAsk && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {selectedRank && (
              <span className="text-sm text-muted-foreground">
                Fråga efter: <strong>{RANK_LABELS[selectedRank] ?? selectedRank}</strong>
              </span>
            )}
            <span className="text-sm text-muted-foreground">hos</span>
            <select
              value={selectedPlayer ?? ""}
              onChange={(e) => setSelectedPlayer(e.target.value || null)}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="">Välj spelare</option>
              {opponentIds.map((id) => (
                <option key={id} value={id}>
                  {playerLabel(id)}
                </option>
              ))}
            </select>
            <Button
              variant="outlinePrimary"
              size="sm"
              onClick={handleAsk}
              disabled={!selectedRank || !selectedPlayer}
            >
              Fråga
            </Button>
          </div>
        )}
      </section>

      {!isHumanTurn && state.phase === "play" && (
        <p className="text-muted-foreground text-center text-sm">Andra spelares tur…</p>
      )}
    </div>
  );
}
