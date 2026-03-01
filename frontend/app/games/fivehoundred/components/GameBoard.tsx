"use client";

import { useState, useCallback } from "react";
import { useGameState } from "../hooks/useGameState";
import {
  StockPile,
  DiscardPile,
  PlayerHand,
  TableMelds,
  MeldBuilderModal,
} from "./index";
import { Button } from "@/components/ui/button";

export function GameBoard() {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [meldBuilderOpen, setMeldBuilderOpen] = useState(false);

  const {
    state,
    humanHand,
    topDiscard,
    isHumanTurn,
    canDraw,
    drawFromStock,
    takeDiscardPile,
    discardCard,
    passWithoutDiscard,
    addMeld,
    addCardToExistingMeld,
    advanceToNextTurn,
    resetGame,
    getPlayerIds,
  } = useGameState();

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

  if (!state) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground">Laddar spel...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">500</h1>
        <div className="flex gap-4 text-sm">
          {getPlayerIds().map((id) => (
            <span key={id}>
              {id === "p1" ? "Du" : id}: {state.playerScores[id]} poäng
            </span>
          ))}
        </div>
      </div>

      {state.winnerId && (
        <div className="rounded-lg border bg-muted/50 p-4 text-center">
          <p className="font-medium">
            {state.winnerId === "p1" ? "Du" : state.winnerId} har vunnit!
          </p>
          <Button onClick={resetGame} className="mt-2">
            Spela igen
          </Button>
        </div>
      )}

      {!state.winnerId && (
        <>
          {!isHumanTurn && state.phase === "draw" && (
            <div className="rounded-lg border border-muted bg-muted/30 p-3 text-center text-sm">
              <p className="text-muted-foreground">
                {state.currentPlayerId === "p2"
                  ? "Spelare 2"
                  : "Spelare 3"}
                s tur.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={advanceToNextTurn}
                className="mt-2"
              >
                Nästa tur
              </Button>
            </div>
          )}
          <div className="flex flex-wrap items-end justify-center gap-8">
            <StockPile
              count={state.stock.length}
              onDraw={drawFromStock}
              disabled={!canDraw}
            />
            <DiscardPile
              topCard={topDiscard}
              onTakePile={takeDiscardPile}
              disabled={!canDraw}
            />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
              Utlagda kombinationer
            </h2>
            <TableMelds melds={state.melds} />
          </div>

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
              />
              {state.phase === "meldOrDiscard" && isHumanTurn && (
                <div className="flex flex-wrap items-center gap-2 self-center">
                  {selectedArr.length === 1 && (
                    <Button type="button" variant="outline" onClick={handleKasta}>
                      Kasta
                    </Button>
                  )}
                  {selectedArr.length >= 1 && (
                    <Button type="button" onClick={handleLayMeldOpen}>
                      Lägg ut
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      passWithoutDiscard();
                      clearSelection();
                    }}
                  >
                    Nöjd
                  </Button>
                </div>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Ett valt kort: Kasta eller Lägg ut. Flera valda: bara Lägg ut. Nöjd = växla tur utan att kasta.
            </p>
          </div>

          <MeldBuilderModal
            hand={humanHand}
            selectedIndices={selectedArr}
            melds={state.melds}
            open={meldBuilderOpen}
            onOpenChange={handleLayMeldClose}
            onConfirmNewMeld={(indices) => {
              addMeld(indices);
              handleLayMeldClose(false);
            }}
            onAddToExistingMeld={(meldId, handIndex) => {
              addCardToExistingMeld(meldId, handIndex);
              handleLayMeldClose(false);
            }}
          />
        </>
      )}
    </div>
  );
}
