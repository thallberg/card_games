"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Meld } from "../types";
import { getMeldDisplayCards } from "../melds";
import { PlayingCard } from "./PlayingCard";

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
                className="flex items-center gap-0.5 rounded-md border border-border bg-card p-2"
              >
                {meld.cards.map((card, i) => (
                  <PlayingCard
                    key={`${meld.id}-${i}`}
                    card={card}
                    faceUp
                    className="h-[80px] w-[56px]"
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
