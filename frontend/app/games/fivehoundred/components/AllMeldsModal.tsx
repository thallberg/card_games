"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Card, Meld } from "../types";
import { getMeldDisplayCards } from "../melds";
import { PlayingCard } from "./PlayingCard";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Alla utlagda kombinationer</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-4">
          {melds.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Inga kombinationer utlagda än.
            </p>
          ) : (
            melds.map((meld) => (
              <div
                key={meld.id}
                className="flex items-end gap-0.5 rounded-md border border-border bg-card p-2"
              >
                {getMeldDisplayCards(meld).map((item, i) => (
                  <div key={`${meld.id}-${i}`} className="flex flex-col items-center">
                    <PlayingCard
                      card={item.card}
                      faceUp
                      className="h-[80px] w-[56px]"
                    />
                    {item.represents != null && (
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        ({cardLabel(item.represents)})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
