"use client";

import type { Card } from "../types";
import { PlayingCard } from "./PlayingCard";
import { cn } from "@/lib/utils";

type PlayerHandProps = {
  cards: Card[];
  selectedIndices?: Set<number>;
  onCardClick?: (card: Card, index: number) => void;
  disabled?: boolean;
};

export function PlayerHand({
  cards,
  selectedIndices = new Set(),
  onCardClick,
  disabled,
}: PlayerHandProps) {
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {cards.map((card, i) => (
        <div
          key={`${card.suit}-${card.rank}-${i}`}
          className={cn(
            "rounded-md ring-2 transition-all",
            selectedIndices.has(i)
              ? "ring-primary ring-offset-2"
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
