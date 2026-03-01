"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Card, Meld } from "../types";
import { getMeldType, canAddCardToMeld } from "../melds";
import { PlayingCard } from "./PlayingCard";
import { getMeldDisplayCards } from "../melds";
import { cn } from "@/lib/utils";

const RANK_LABELS: Record<string, string> = {
  "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8",
  "9": "9", "10": "10", jack: "Knekt", queen: "Dam", king: "Kung", ace: "Ess",
};
const SUIT_LABELS: Record<string, string> = {
  hearts: "hjärter", diamonds: "ruter", clubs: "klöver", spades: "spader",
};

function cardLabel(c: Card): string {
  return `${RANK_LABELS[c.rank] ?? c.rank} ${SUIT_LABELS[c.suit] ?? c.suit}`;
}

type MeldBuilderModalProps = {
  hand: Card[];
  selectedIndices: number[];
  melds: Meld[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmNewMeld: (cardIndices: number[]) => void;
  onAddToExistingMeld: (meldId: string, handIndex: number) => void;
};

export function MeldBuilderModal({
  hand,
  selectedIndices,
  melds,
  open,
  onOpenChange,
  onConfirmNewMeld,
  onAddToExistingMeld,
}: MeldBuilderModalProps) {
  const [pickedForNew, setPickedForNew] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) setPickedForNew(new Set(selectedIndices.slice(0, 3)));
  }, [open, selectedIndices]);

  const selectedCards = selectedIndices.map((i) => hand[i]).filter(Boolean);
  const pickedIndices = [...pickedForNew].filter((i) => selectedIndices.includes(i));
  const pickedCards = pickedIndices.map((i) => hand[i]);
  const newMeldType = pickedCards.length >= 3 ? getMeldType(pickedCards) : null;
  const canLayNew = newMeldType !== null;

  const togglePicked = (handIndex: number) => {
    if (!selectedIndices.includes(handIndex)) return;
    setPickedForNew((prev) => {
      const next = new Set(prev);
      if (next.has(handIndex)) next.delete(handIndex);
      else next.add(handIndex);
      return next;
    });
  };

  const handleLayNew = () => {
    if (!canLayNew) return;
    onConfirmNewMeld(pickedIndices.sort((a, b) => a - b));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lägg ut</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          Dina valda kort kan antingen bilda en ny kombination eller läggas till på befintliga.
        </p>

        <section>
          <h3 className="mb-2 font-medium text-sm">Lägg ny kombination</h3>
          <p className="text-muted-foreground mb-2 text-xs">
            Välj minst 3 av dina valda kort (tretal/fyrtal eller stege).
          </p>
          <div className="flex flex-wrap gap-1">
            {selectedIndices.map((i) => {
              const card = hand[i];
              if (!card) return null;
              const picked = pickedForNew.has(i);
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => togglePicked(i)}
                  onKeyDown={(e) => e.key === "Enter" && togglePicked(i)}
                  className={cn(
                    "cursor-pointer rounded-md ring-2 transition-all",
                    picked ? "ring-primary ring-offset-2" : "ring-transparent opacity-70 hover:opacity-100"
                  )}
                >
                  <PlayingCard card={card} faceUp className="h-[72px] w-[50px]" />
                </div>
              );
            })}
          </div>
          {pickedIndices.length >= 3 && (
            <p className="mt-1 text-sm">
              {newMeldType ? (
                <span className="text-green-600 dark:text-green-400">
                  {newMeldType === "set" ? "Tretal/fyrtal" : "Stege"} ✓
                </span>
              ) : (
                <span className="text-destructive">Ogiltig kombination</span>
              )}
            </p>
          )}
          <Button
            className="mt-2 w-full"
            onClick={handleLayNew}
            disabled={!canLayNew}
          >
            Lägg ut ny kombination
          </Button>
        </section>

        {melds.length > 0 && (
          <section className="border-t pt-4">
            <h3 className="mb-2 font-medium text-sm">Lägg till på befintlig</h3>
            <p className="text-muted-foreground mb-2 text-xs">
              Klicka för att lägga ett av dina valda kort på en kombination.
            </p>
            <div className="space-y-3">
              {melds.map((meld) => {
                const displayCards = getMeldDisplayCards(meld);
                const addable = selectedIndices.filter((i) => canAddCardToMeld(hand[i], meld));
                return (
                  <div
                    key={meld.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2"
                  >
                    <div className="flex gap-0.5">
                      {displayCards.map((c, j) => (
                        <PlayingCard key={j} card={c} faceUp className="h-[56px] w-[40px]" />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {addable.map((handIndex) => (
                        <Button
                          key={handIndex}
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            onAddToExistingMeld(meld.id, handIndex);
                            onOpenChange(false);
                          }}
                        >
                          Lägg {cardLabel(hand[handIndex])}
                        </Button>
                      ))}
                      {addable.length === 0 && (
                        <span className="text-muted-foreground text-xs">
                          Inget av dina valda kort passar här
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Avbryt
        </Button>
      </DialogContent>
    </Dialog>
  );
}
