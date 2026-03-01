"use client";

import type { Card } from "../types";
import { PlayingCard } from "./PlayingCard";
import { cn } from "@/lib/utils";

type PlayerHandProps = {
  cards: Card[];
  selectedIndices?: Set<number>;
  onCardClick?: (card: Card, index: number) => void;
  disabled?: boolean;
  /** Kort som nyss plockats – visas med grön ram. */
  lastDrawnCard?: Card | null;
};

function cardEquals(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function PlayerHand({
  cards,
  selectedIndices = new Set(),
  onCardClick,
  disabled,
  lastDrawnCard,
}: PlayerHandProps) {
  const lastDrawnIndex = lastDrawnCard != null ? cards.findIndex((c) => cardEquals(c, lastDrawnCard)) : -1;
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {cards.map((card, i) => (
        <div
          key={`${card.suit}-${card.rank}-${i}`}
          className={cn(
            "rounded-md ring-2 transition-all ring-offset-2",
            selectedIndices.has(i)
              ? "ring-primary"
              : lastDrawnIndex === i
                ? "ring-green-500"
                : "ring-transparent"
          )}
        >
          <PlayingCard
            card={card}
            faceUp
            onClick={
              onCardClick && !disabled
                ? () => onCardClick(card, i)
                : undefined
            }
          />
        </div>
      ))}
    </div>
  );
}
