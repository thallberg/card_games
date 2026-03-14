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
import { getMeldType, canAddCardToMeld, isWild, getWildOptionsForRun, getWildOptionsForSet, getEffectiveMeldCards, isEffectiveRun, isValidEffectiveRun, isValidEffectiveSet } from "../melds";
import { PlayingCard } from "@/components/playing-card";
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
  myPlayerId: string;
  hasLaidFirstMeld: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** cardIndices = hand-index, wildRepresents = index i den nya melden -> vilket kort 2:an ska vara */
  onConfirmNewMeld: (cardIndices: number[], wildRepresents?: Record<number, Card>) => void;
  onAddToExistingMeld: (meldId: string, handIndex: number, wildAs?: Card) => void;
};

function cardsEqual(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function MeldBuilderModal({
  hand,
  selectedIndices,
  melds,
  myPlayerId,
  hasLaidFirstMeld,
  open,
  onOpenChange,
  onConfirmNewMeld,
  onAddToExistingMeld,
}: MeldBuilderModalProps) {
  const [pickedForNew, setPickedForNew] = useState<Set<number>>(new Set());
  /** Index i pickedCards (0-baserat) -> vilket kort 2:an ska representera */
  const [wildSelections, setWildSelections] = useState<Record<number, Card>>({});
  /** När användaren lägger en 2 på befintlig meld: visa val av vad 2:an ska vara */
  const [pendingAddWild, setPendingAddWild] = useState<{ meldId: string; handIndex: number } | null>(null);

  useEffect(() => {
    if (open) {
      setPickedForNew(new Set(selectedIndices));
      setWildSelections({});
      setPendingAddWild(null);
    }
  }, [open, selectedIndices]);

  const pickedIndices = [...pickedForNew].filter((i) => i >= 0 && i < hand.length).sort((a, b) => a - b);
  const pickedCards = pickedIndices.map((i) => hand[i]).filter(Boolean);
  const newMeldType = pickedCards.length >= 3 ? getMeldType(pickedCards) : null;
  const wildIndicesInPicked = pickedCards.map((_, i) => (isWild(pickedCards[i]) ? i : -1)).filter((i) => i >= 0);
  const nonWildInPicked = pickedCards.filter((c) => !isWild(c));
  const isSetWithLockedWild = newMeldType === "set" && nonWildInPicked.length >= 2;
  const wildOptions = newMeldType && wildIndicesInPicked.length > 0
    ? (newMeldType === "run" ? getWildOptionsForRun(pickedCards) : getWildOptionsForSet(pickedCards))
    : [];
  const autoSetWilds = isSetWithLockedWild && wildOptions.length > 0;
  const allWildsChosen = wildIndicesInPicked.length === 0
    || autoSetWilds
    || wildIndicesInPicked.every((i) => wildSelections[i]);
  const effectiveCards = autoSetWilds && wildOptions.length > 0
    ? pickedCards.map((c, i) => {
        if (isWild(c)) {
          const wildIdx = wildIndicesInPicked.indexOf(i);
          return wildOptions[wildIdx % wildOptions.length] ?? c;
        }
        return c;
      })
    : pickedCards.map((c, i) => wildSelections[i] ?? c);
  const effectiveMeldValid = newMeldType === "run"
    ? isValidEffectiveRun(effectiveCards)
    : newMeldType === "set"
      ? isValidEffectiveSet(effectiveCards)
      : false;
  const canLayNew = newMeldType !== null && allWildsChosen && effectiveMeldValid;

  const togglePicked = (handIndex: number) => {
    if (handIndex < 0 || handIndex >= hand.length) return;
    setPickedForNew((prev) => {
      const next = new Set(prev);
      if (next.has(handIndex)) next.delete(handIndex);
      else next.add(handIndex);
      return next;
    });
    setWildSelections({});
  };

  const setWildChoice = (pickedCardIndex: number, choice: Card) => {
    setWildSelections((prev) => ({ ...prev, [pickedCardIndex]: choice }));
  };

  const handleLayNew = () => {
    if (!canLayNew) return;
    let wildRepresents: Record<number, Card> = {};
    if (autoSetWilds && wildOptions.length > 0) {
      wildIndicesInPicked.forEach((meldIdx, i) => {
        wildRepresents[meldIdx] = wildOptions[i % wildOptions.length];
      });
    } else {
      wildIndicesInPicked.forEach((i) => {
        if (wildSelections[i]) wildRepresents[i] = wildSelections[i];
      });
    }
    onConfirmNewMeld(pickedIndices, Object.keys(wildRepresents).length > 0 ? wildRepresents : undefined);
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
            Välj minst 3 kort (klicka på korten) – du kan lägga ut en hel stege, t.ex. 5–6–7–8–9. 2:or = 25 p, välj vad 2:an ska vara.
          </p>
          <div className="flex flex-wrap gap-1">
            {hand.map((card, i) => {
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
          {newMeldType && wildIndicesInPicked.length > 0 && !autoSetWilds && (
            <div className="mt-3 rounded-md border bg-muted/30 p-3">
              <p className="mb-2 text-sm font-medium">2:an är valfritt kort – välj vilket kort den ska vara (den ger fortfarande 25 poäng)</p>
              <div className="space-y-2">
                {wildIndicesInPicked.map((meldIdx, num) => (
                  <div key={meldIdx} className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground text-sm">
                      {wildIndicesInPicked.length > 1 ? `2:a ${num + 1}:` : "2:a:"}
                    </span>
                    {wildOptions.map((opt) => (
                      <Button
                        key={`${meldIdx}-${opt.suit}-${opt.rank}`}
                        size="sm"
                        variant={wildSelections[meldIdx] && cardsEqual(wildSelections[meldIdx], opt) ? "default" : "outline"}
                        onClick={() => setWildChoice(meldIdx, opt)}
                      >
                        {cardLabel(opt)}
                      </Button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
          {allWildsChosen && newMeldType && !effectiveMeldValid && (
            <p className="text-destructive mt-2 text-xs">Välj olika kort för varje 2:a så att kombinationen blir giltig.</p>
          )}
          <Button
            variant="outlinePrimary"
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
                const isOwnMeld = (meld.ownerId ?? myPlayerId) === myPlayerId;
                const canAddToThisMeld = isOwnMeld || hasLaidFirstMeld;
                const addable = canAddToThisMeld
                  ? hand.map((_, i) => i).filter((i) => canAddCardToMeld(hand[i], meld))
                  : [];
                const pending = pendingAddWild?.meldId === meld.id ? pendingAddWild : null;
                const meldIsRun = meld.type === "run" || isEffectiveRun(meld);
                const addWildOptions = pending
                  ? (meldIsRun
                      ? getWildOptionsForRun([...getEffectiveMeldCards(meld), hand[pending.handIndex]])
                      : getWildOptionsForSet([...meld.cards, hand[pending.handIndex]]))
                  : [];
                return (
                  <div
                    key={meld.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2"
                  >
                    <div className="flex gap-0.5 items-end">
                      {getMeldDisplayCards(meld).map((item, j) => (
                        <div key={j} className="flex flex-col items-center">
                          {item.represents != null && (
                            <span className="text-[10px] text-muted-foreground mb-0.5">
                              ({cardLabel(item.represents)})
                            </span>
                          )}
                          <PlayingCard card={item.card} faceUp className="h-[56px] w-[40px]" />
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {addable.map((handIndex) => {
                        const card = hand[handIndex];
                        const isWildCard = isWild(card);
                        const showChoice = pending?.handIndex === handIndex;
                        if (isWildCard && !meldIsRun) {
                          const setOpts = getWildOptionsForSet([...meld.cards, card]);
                          const autoOpt = setOpts[0];
                          return (
                            <Button
                              key={handIndex}
                              size="sm"
                              variant="outlineSecondary"
                              onClick={() => {
                                onAddToExistingMeld(meld.id, handIndex, autoOpt ?? undefined);
                                onOpenChange(false);
                              }}
                            >
                              Lägg {cardLabel(card)}
                            </Button>
                          );
                        }
                        if (isWildCard && !showChoice) {
                          return (
                            <Button
                              key={handIndex}
                              size="sm"
                              variant="outlineSecondary"
                              onClick={() => setPendingAddWild({ meldId: meld.id, handIndex })}
                            >
                              Lägg {cardLabel(card)}
                            </Button>
                          );
                        }
                        if (isWildCard && showChoice) {
                          return (
                            <div key={handIndex} className="flex flex-wrap items-center gap-1">
                              <span className="text-muted-foreground text-xs">2:an är valfritt kort – välj vad den ska vara (25 poäng, du kan bygga vidare på den)</span>
                              {addWildOptions.map((opt) => (
                                <Button
                                  key={`${opt.suit}-${opt.rank}`}
                                  size="sm"
                                  variant="outlinePrimary"
                                  onClick={() => {
                                    onAddToExistingMeld(meld.id, handIndex, opt);
                                    setPendingAddWild(null);
                                    onOpenChange(false);
                                  }}
                                >
                                  {cardLabel(opt)}
                                </Button>
                              ))}
                              <Button size="sm" variant="ghost" onClick={() => setPendingAddWild(null)}>
                                Avbryt
                              </Button>
                            </div>
                          );
                        }
                        return (
                          <Button
                            key={handIndex}
                            size="sm"
                            variant="outlineSecondary"
                            onClick={() => {
                              onAddToExistingMeld(meld.id, handIndex);
                              onOpenChange(false);
                            }}
                          >
                            Lägg {cardLabel(card)}
                          </Button>
                        );
                      })}
                      {addable.length === 0 && !pending && (
                        <span className="text-muted-foreground text-xs">
                          {!canAddToThisMeld
                            ? "Lägg ut minst en egen triss eller stege först."
                            : "Inget av dina valda kort passar här"}
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
