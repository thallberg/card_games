"use client";

import type { Card } from "../types";
import { PlayingCard } from "@/components/playing-card";

/** 10 olika vinklar – varje kort i högen får sin vinkel så de staplas med kanter som syns. */
const CARD_ANGLES = [-6, 4, -3, 7, -5, 2, -8, 5, -4, 6];

const MAX_VISIBLE = 10;

type DiscardPileProps = {
  discard: Card[];
  onTakePile: () => void;
  disabled?: boolean;
};

export function DiscardPile({ discard, onTakePile, disabled }: DiscardPileProps) {
  const visible = discard.slice(0, MAX_VISIBLE);

  return (
    <div className="flex flex-col items-center gap-1">
      {visible.length > 0 ? (
        <div className="relative h-[80px] w-[56px] overflow-visible sm:h-[100px] sm:w-[70px] md:h-[120px] md:w-[84px] shrink-0">
          {visible.map((card, i) => {
            const slot = visible.length - 1 - i;
            const angle = CARD_ANGLES[slot % CARD_ANGLES.length];
            const offsetY = slot * 2;
            const isTop = i === 0;

            return (
              <div
                key={`${card.suit}-${card.rank}-${i}`}
                className="absolute left-1/2 top-1/2 origin-center transition-transform duration-150"
                style={{
                  transform: `translate(-50%, calc(-50% + ${offsetY}px)) rotate(${angle}deg)`,
                  zIndex: slot,
                }}
              >
                <PlayingCard
                  card={card}
                  faceUp
                  onClick={isTop && !disabled ? onTakePile : undefined}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-[80px] w-[56px] sm:h-[100px] sm:w-[70px] md:h-[120px] md:w-[84px] shrink-0 items-center justify-center rounded-md border-2 border-dashed border-[var(--warm-coral)]/25 bg-[var(--warm-rose)]/30 text-muted-foreground text-xs">
          –
        </div>
      )}
      <span className="text-muted-foreground text-xs">Kast</span>
    </div>
  );
}
