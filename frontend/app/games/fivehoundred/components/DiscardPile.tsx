"use client";

import type { Card } from "../types";
import { PlayingCard } from "./PlayingCard";

type DiscardPileProps = {
  topCard: Card | null;
  onTakePile: () => void;
  disabled?: boolean;
};

export function DiscardPile({ topCard, onTakePile, disabled }: DiscardPileProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      {topCard ? (
        <PlayingCard
          card={topCard}
          faceUp
          onClick={disabled ? undefined : onTakePile}
        />
      ) : (
        <div className="flex h-[80px] w-[56px] sm:h-[100px] sm:w-[70px] md:h-[120px] md:w-[84px] shrink-0 items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/20 bg-muted/30 text-muted-foreground text-xs">
          –
        </div>
      )}
      <span className="text-muted-foreground text-xs">Kast</span>
    </div>
  );
}
