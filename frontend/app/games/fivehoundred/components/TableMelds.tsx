"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Card, Meld } from "../types";
import { getMeldDisplayCards, getFullMeldDisplayCards } from "../melds";
import { PlayingCard } from "@/components/playing-card";
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

type TableMeldsProps = {
  melds: Meld[];
  /** Ids för nyligen utlagda melds – visas med grön ram. */
  lastLaidMeldIds?: string[];
};

function isCompletedSet(meld: Meld): boolean {
  if (meld.type === "run") return false;
  return meld.cards.length >= 4;
}

export function TableMelds({ melds, lastLaidMeldIds = [] }: TableMeldsProps) {
  const [popupMeld, setPopupMeld] = useState<Meld | null>(null);
  const recentSet = new Set(lastLaidMeldIds);
  const sortedMelds = [...melds].sort((a, b) => {
    const aRecent = recentSet.has(a.id) ? 1 : 0;
    const bRecent = recentSet.has(b.id) ? 1 : 0;
    if (aRecent !== bRecent) return bRecent - aRecent;
    const aComplete = isCompletedSet(a) ? 1 : 0;
    const bComplete = isCompletedSet(b) ? 1 : 0;
    return aComplete - bComplete;
  });
  return (
    <div className="w-full max-h-[320px] overflow-y-auto overflow-x-hidden rounded-lg border border-dashed border-muted-foreground/20 bg-muted/10">
      <div className="grid grid-cols-3 gap-3 p-4">
        {melds.length === 0 ? (
          <p className="col-span-3 flex min-h-[200px] items-center justify-center text-muted-foreground text-sm">
            Inga kombinationer utlagda än.
          </p>
        ) : (
          sortedMelds.map((meld) => (
            <div
              key={meld.id}
              role="button"
              tabIndex={0}
              onClick={() => setPopupMeld(meld)}
              onKeyDown={(e) => e.key === "Enter" && setPopupMeld(meld)}
              className={cn(
                "flex flex-wrap items-center justify-center gap-0.5 rounded-md border-2 p-2 transition-colors text-left cursor-pointer hover:ring-2 hover:ring-primary/50 focus:outline-none focus:ring-2 focus:ring-primary",
                recentSet.has(meld.id)
                  ? "border-green-500 bg-green-500/10"
                  : "border-border bg-card"
              )}
            >
              <div className="flex items-end gap-1">
                {getMeldDisplayCards(meld).map((item, i) => (
                  <div
                    key={`${meld.id}-${i}`}
                    className="flex flex-col items-center shrink-0"
                  >
                    {item.represents != null && (
                      <span className="text-[10px] text-muted-foreground mb-0.5 whitespace-nowrap">
                        ({cardLabel(item.represents)})
                      </span>
                    )}
                    <PlayingCard
                      card={item.card}
                      faceUp
                      className="h-[100px] w-[70px] shrink-0 shadow-md"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      <Dialog open={!!popupMeld} onOpenChange={(open) => !open && setPopupMeld(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alla kort i kombinationen</DialogTitle>
          </DialogHeader>
          {popupMeld && (
            <div className="flex flex-wrap gap-2 justify-center items-end p-2">
              {getFullMeldDisplayCards(popupMeld).map((item, i) => (
                <div key={i} className="flex flex-col items-center">
                  {item.represents != null && (
                    <span className="text-[10px] text-muted-foreground mb-0.5">
                      ({cardLabel(item.represents)})
                    </span>
                  )}
                  <PlayingCard
                    card={item.card}
                    faceUp
                    className="h-[100px] w-[70px] shrink-0 shadow-md"
                  />
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
