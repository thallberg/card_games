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

type AllMeldsModalProps = {
  melds: Meld[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AllMeldsModal({ melds, open, onOpenChange }: AllMeldsModalProps) {
  const [popupMeld, setPopupMeld] = useState<Meld | null>(null);
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Alla utlagda kombinationer</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Klicka på en hög för att se alla kort.
          </p>
          <div className="flex flex-wrap gap-4">
            {melds.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Inga kombinationer utlagda än.
              </p>
            ) : (
              melds.map((meld) => (
                <div
                  key={meld.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setPopupMeld(meld)}
                  onKeyDown={(e) => e.key === "Enter" && setPopupMeld(meld)}
                  className="flex items-end gap-0.5 rounded-md border border-border bg-card p-2 cursor-pointer hover:ring-2 hover:ring-primary/50 focus:outline-none focus:ring-2 focus:ring-primary text-left"
                >
                  {getMeldDisplayCards(meld).map((item, i) => (
                    <div key={`${meld.id}-${i}`} className="flex flex-col items-center">
                      {item.represents != null && (
                        <span className="text-[10px] text-muted-foreground mb-0.5">
                          ({cardLabel(item.represents)})
                        </span>
                      )}
                      <PlayingCard
                        card={item.card}
                        faceUp
                        className="h-[80px] w-[56px]"
                      />
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!popupMeld} onOpenChange={(o) => !o && setPopupMeld(null)}>
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
    </>
  );
}
