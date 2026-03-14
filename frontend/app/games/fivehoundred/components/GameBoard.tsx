"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useGameState } from "../hooks/useGameState";
import { useGameStateMultiplayer } from "../hooks/useGameStateMultiplayer";
import {
  StockPile,
  DiscardPile,
  PlayerHand,
  TableMelds,
  MeldBuilderModal,
} from "./index";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCardPoints } from "../scoring";

type GameBoardProps = { sessionId?: string; playerCount?: number };

export function GameBoard({ sessionId, playerCount = 2 }: GameBoardProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [meldBuilderOpen, setMeldBuilderOpen] = useState(false);
  const [takeDiscardDialogOpen, setTakeDiscardDialogOpen] = useState(false);

  const single = useGameState(playerCount);
  const multi = useGameStateMultiplayer(sessionId);
  const useMulti = !!sessionId;
  const {
    state,
    loading,
    waitingForStart,
    humanHand,
    isHumanTurn,
    stockEmpty,
    drawFromStock,
    takeDiscardPile,
    skipDraw,
    discardCard,
    passWithoutDiscard,
    addMeld,
    addCardToExistingMeld,
    advanceToNextTurn,
    resetGame,
    startNewRound,
    getPlayerIds,
    playerDisplayNames,
    playerAvatarEmojis,
    myPlayerId,
    lastDrawnCards,
    hasLaidFirstMeld,
  } = useMulti ? multi : single;

  const playerLabel = (id: string) => {
    if (id === myPlayerId) return (useMulti && playerDisplayNames?.[id]) ? `${playerDisplayNames[id]} (Du)` : "Du";
    if (useMulti && playerDisplayNames?.[id]) return playerDisplayNames[id];
    const numPlayers = state ? Object.keys(state.playerHands).length : 2;
    return numPlayers === 2 ? "Motståndare" : "Spelare " + id;
  };
  const playerLabelGenitive = (id: string) => {
    if (id === myPlayerId) return (useMulti && playerDisplayNames?.[id]) ? `${playerDisplayNames[id]} (Du)` : "Du";
    if (useMulti && playerDisplayNames?.[id]) return playerDisplayNames[id];
    const numPlayers = state ? Object.keys(state.playerHands).length : 2;
    return numPlayers === 2 ? "Motståndaren" : "Spelare " + id;
  };

  const canDraw = state != null && state.phase === "draw" && state.currentPlayerId === myPlayerId;

  const toggleSelection = useCallback((_card: unknown, index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIndices(new Set()), []);

  const selectedArr = [...selectedIndices];
  const oneSelected = selectedArr.length === 1 ? selectedArr[0] : null;

  const handleKasta = () => {
    if (oneSelected == null) return;
    discardCard(oneSelected);
    clearSelection();
  };

  const handleLayMeldOpen = () => {
    if (selectedArr.length === 0) return;
    setMeldBuilderOpen(true);
  };

  const handleLayMeldClose = (open: boolean) => {
    setMeldBuilderOpen(open);
    if (!open) clearSelection();
  };

  const handleTakeDiscardClick = useCallback(() => {
    setTakeDiscardDialogOpen(true);
  }, []);

  const handleTakeDiscardConfirm = useCallback(() => {
    takeDiscardPile();
    setTakeDiscardDialogOpen(false);
  }, [takeDiscardPile]);

  const handleTakeDiscardCancel = useCallback(() => {
    setTakeDiscardDialogOpen(false);
  }, []);

  const roundMeldPoints = useMemo(() => {
    const byPlayer: Record<string, number> = {};
    const ids = state ? Object.keys(state.playerHands) : [];
    for (const id of ids) byPlayer[id] = 0;
    for (const meld of state?.melds ?? []) {
      const defaultOwner = meld.ownerId ?? ids[0];
      meld.cards.forEach((card, i) => {
        const pointOwner = meld.cardContributors?.[i] ?? defaultOwner;
        if (byPlayer[pointOwner] !== undefined) {
          byPlayer[pointOwner] += getCardPoints(card);
        }
      });
    }
    return byPlayer;
  }, [state?.melds, state?.playerHands]);

  if (!state) {
    if (useMulti && waitingForStart) {
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground text-center">
            Väntar på att partiledaren startar spelet.
          </p>
          <p className="text-muted-foreground text-sm text-center">
            Spelet startar automatiskt när partiledaren klickar &quot;Starta spelet&quot; i Mina spel.
          </p>
          <Button asChild variant="outline">
            <Link href="/spel">Gå till Mina spel</Link>
          </Button>
        </div>
      );
    }
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground">{loading ? "Laddar spel..." : "Kunde inte ladda spelet."}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 px-1 sm:px-0">
      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
        <div className="flex flex-wrap gap-4 sm:gap-6 text-xs sm:text-sm">
          {getPlayerIds().map((id) => {
            const handSize = state.playerHands[id]?.length ?? 0;
            return (
              <div key={id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  {state.currentPlayerId === id && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-green-500 ring-2 ring-green-500/40"
                      aria-hidden
                    />
                  )}
                  <span className="font-medium">{playerLabel(id)}</span>
                  {playerAvatarEmojis?.[id] && <span className="ml-0.5" aria-hidden>{playerAvatarEmojis[id]}</span>}
                </div>
                {id !== myPlayerId && state.phase !== "roundEnd" && state.phase !== "gameOver" && (
                  <span className="text-muted-foreground">
                    {handSize} kort på handen
                  </span>
                )}
                {state.phase !== "roundEnd" && state.phase !== "gameOver" && (
                  <span className="text-muted-foreground">
                    Rundans poäng (utlagda): {roundMeldPoints[id] ?? 0}
                  </span>
                )}
                <span className="text-muted-foreground">
                  Sammanlagda poäng: {state.playerScores[id] ?? 0}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {state.phase === "gameOver" && state.winnerId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--warm-peach)]/50 p-4 text-center">
          <p className="font-medium">
            {state.winnerId ? playerLabelGenitive(state.winnerId) + (playerAvatarEmojis?.[state.winnerId] ? " " + playerAvatarEmojis[state.winnerId] : "") + " har vunnit spelet!" : ""}
          </p>
          <Button variant="outlinePrimary" onClick={resetGame} className="mt-2">
            Spela igen
          </Button>
        </div>
      )}

      {state.phase === "roundEnd" && state.winnerId && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--warm-peach)]/50 p-4 text-center">
          <p className="font-medium">
            Rundan över! {state.winnerId ? playerLabelGenitive(state.winnerId) + (playerAvatarEmojis?.[state.winnerId] ? " " + playerAvatarEmojis[state.winnerId] : "") + " gick ut." : ""}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            Poäng: {getPlayerIds().map((id) => `${playerLabel(id)}${playerAvatarEmojis?.[id] ? " " + playerAvatarEmojis[id] : ""} ${state.playerScores[id] ?? 0}`).join(", ")}
          </p>
          <Button variant="outlinePrimary" onClick={startNewRound} className="mt-2">
            Nästa rond
          </Button>
        </div>
      )}

      {state.phase !== "roundEnd" && state.phase !== "gameOver" && (
        <>
          <div className="flex flex-wrap items-end justify-center gap-4 sm:gap-8">
            <StockPile
              count={state.stock.length}
              onDraw={drawFromStock}
              disabled={!canDraw}
              isMyTurn={isHumanTurn}
            />
            <DiscardPile
              discard={state.discard ?? []}
              onTakePile={handleTakeDiscardClick}
              disabled={!canDraw}
            />
            {stockEmpty && isHumanTurn && state.phase === "draw" && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-muted-foreground text-sm">Talongen är tom – du kan inte dra.</p>
                <Button onClick={skipDraw} variant="outline" size="sm">
                  Fortsätt utan att dra
                </Button>
                <p className="text-muted-foreground text-xs">Sedan kan du lägga ut eller kasta som vanligt.</p>
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
              Utlagda kombinationer
            </h2>
            <TableMelds melds={state.melds} lastLaidMeldIds={state.lastLaidMeldIds} />
          </div>

          {state.lastDraw === "discard" && isHumanTurn && (
            <p className="rounded-md border border-[var(--warm-gold)]/50 bg-[var(--warm-gold)]/15 px-3 py-2 text-sm text-foreground">
              Du plockade kast högen – lägg ut minst 3 kort denna tur, annars −50 poäng.
            </p>
          )}
          <div>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
              Din hand
              {isHumanTurn && canDraw && (
                <span className="ml-2 font-normal">
                  – Dra från talong eller ta kast högen
                </span>
              )}
              {isHumanTurn && !canDraw && (
                <span className="ml-2 font-normal">
                  – Välj kort, sedan Kasta eller Lägg ut
                </span>
              )}
            </h2>
            {state.phase === "meldOrDiscard" && isHumanTurn && (
              <div className="mb-3 flex w-full gap-2">
                {selectedArr.length === 0 ? (
                  !stockEmpty && (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 w-full border-2 border-[var(--btn-nöjd)] bg-transparent text-[var(--btn-nöjd-foreground)] hover:bg-[var(--btn-nöjd)]/15"
                      onClick={() => {
                        passWithoutDiscard();
                        clearSelection();
                      }}
                    >
                      Nöjd
                    </Button>
                  )
                ) : (
                  <>
                    {selectedArr.length === 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleKasta}
                        className="min-h-11 flex-1 border-2 border-[var(--btn-kasta)] bg-transparent text-[var(--btn-kasta-foreground)] hover:bg-[var(--btn-kasta)]/15"
                      >
                        Kasta
                      </Button>
                    )}
                    <Button type="button" variant="outlinePrimary" onClick={handleLayMeldOpen} className="min-h-11 flex-1">
                      Lägg ut
                    </Button>
                  </>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <PlayerHand
                cards={humanHand}
                selectedIndices={selectedIndices}
                onCardClick={
                  state.phase === "meldOrDiscard"
                    ? toggleSelection
                    : undefined
                }
                disabled={!isHumanTurn || canDraw}
                lastDrawnCards={lastDrawnCards ?? []}
              />
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {stockEmpty
                ? "Talongen är tom – du måste kasta ett kort (välj kort och klicka Kasta)."
                : "Ett valt kort: Kasta eller Lägg ut. Flera valda: bara Lägg ut. Nöjd = växla tur utan att kasta."}
            </p>
          </div>

          <MeldBuilderModal
            hand={humanHand}
            selectedIndices={selectedArr}
            melds={state.melds}
            myPlayerId={myPlayerId}
            hasLaidFirstMeld={hasLaidFirstMeld ?? false}
            open={meldBuilderOpen}
            onOpenChange={handleLayMeldClose}
            onConfirmNewMeld={(indices, wildRepresents) => {
              addMeld(indices, wildRepresents);
              handleLayMeldClose(false);
            }}
            onAddToExistingMeld={(meldId, handIndex, wildAs) => {
              addCardToExistingMeld(meldId, handIndex, wildAs);
              handleLayMeldClose(false);
            }}
          />

          <Dialog open={takeDiscardDialogOpen} onOpenChange={setTakeDiscardDialogOpen}>
            <DialogContent showCloseButton={false}>
              <DialogHeader>
                <DialogTitle>Plocka kast högen</DialogTitle>
                <DialogDescription>
                  Vill du plocka hela kast högen? Du får alla {(state.discard ?? []).length} kort på handen.
                  Kom ihåg att du måste lägga ut minst 3 kort denna tur, annars får du −50 poäng.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={handleTakeDiscardCancel}>
                  Avbryt
                </Button>
                <Button variant="outlinePrimary" onClick={handleTakeDiscardConfirm}>
                  Okej
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
