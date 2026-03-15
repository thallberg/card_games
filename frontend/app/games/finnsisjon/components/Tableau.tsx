"use client";

import { PlayingCard } from "@/components/playing-card";
import type { Card } from "../types";

type TableauPile = Card[];

type TableauProps = {
  tableau: TableauPile[];
};

export function Tableau({ tableau }: TableauProps) {
  return (
    <div className="flex flex-wrap items-end justify-center gap-3 sm:gap-4">
      {tableau.map((pile, pileIdx) => (
        <div key={pileIdx} className="flex flex-col items-center gap-0">
          <div className="relative flex items-end justify-center" style={{ minHeight: 88 }}>
            {pile.map((card, cardIdx) => {
              const isTop = cardIdx === pile.length - 1;
              const faceUp = isTop;
              return (
                <div
                  key={cardIdx}
                  className="absolute"
                  style={{
                    left: `${cardIdx * 12}px`,
                    bottom: 0,
                    zIndex: cardIdx,
                  }}
                >
                  {faceUp ? (
                    <PlayingCard card={card} faceUp size="sm" />
                  ) : (
                    <PlayingCard card={card} faceUp={false} faceDownVariant="cardback" size="sm" />
                  )}
                </div>
              );
            })}
          </div>
          <span className="text-muted-foreground text-xs mt-1">Hög {pileIdx + 1}</span>
        </div>
      ))}
    </div>
  );
}
