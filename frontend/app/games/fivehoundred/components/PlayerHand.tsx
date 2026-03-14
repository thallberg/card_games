"use client";

import type { Card } from "../types";
import { PlayingCard } from "@/components/playing-card";
import { cn } from "@/lib/utils";

type PlayerHandProps = {
  cards: Card[];
  selectedIndices?: Set<number>;
  onCardClick?: (card: Card, index: number) => void;
  disabled?: boolean;
  /** Kort som nyss plockats – visas med grön ram (ett eller flera vid kast-hög). */
  lastDrawnCards?: Card[];
};

function cardEquals(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

function indicesOfDrawnCards(hand: Card[], drawn: Card[]): Set<number> {
  const toMatch = [...drawn];
  const highlighted = new Set<number>();
  hand.forEach((card, i) => {
    const idx = toMatch.findIndex((c) => cardEquals(c, card));
    if (idx >= 0) {
      highlighted.add(i);
      toMatch.splice(idx, 1);
    }
  });
  return highlighted;
}

export function PlayerHand({
  cards,
  selectedIndices = new Set(),
  onCardClick,
  disabled,
  lastDrawnCards = [],
}: PlayerHandProps) {
  const lastDrawnIndices = lastDrawnCards.length > 0 ? indicesOfDrawnCards(cards, lastDrawnCards) : new Set<number>();
  return (
    <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
      {cards.map((card, i) => (
        <div key={`${card.suit}-${card.rank}-${i}`} className="rounded-md">
          <PlayingCard
            card={card}
            faceUp
            selected={selectedIndices.has(i)}
            highlight={lastDrawnIndices.has(i)}
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
