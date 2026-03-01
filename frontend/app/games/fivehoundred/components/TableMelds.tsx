"use client";

import type { Meld } from "../types";
import { getMeldDisplayCards } from "../melds";
import { PlayingCard } from "./PlayingCard";

type TableMeldsProps = {
  melds: Meld[];
};


export function TableMelds({ melds }: TableMeldsProps) {
  const displayCards = (m: Meld) => getMeldDisplayCards(m);

  return (
    <div className="w-full max-h-[320px] overflow-y-auto overflow-x-hidden rounded-lg border border-dashed border-muted-foreground/20 bg-muted/10">
      <div className="grid grid-cols-3 gap-3 p-4">
        {melds.length === 0 ? (
          <p className="col-span-3 flex min-h-[200px] items-center justify-center text-muted-foreground text-sm">
            Inga kombinationer utlagda än.
          </p>
        ) : (
          melds.map((meld) => (
            <div
              key={meld.id}
              className="flex flex-wrap items-center justify-center gap-0.5 rounded-md border border-border bg-card p-2"
            >
              {displayCards(meld).map((card, i) => (
                <PlayingCard
                  key={`${meld.id}-${i}`}
                  card={card}
                  faceUp
                  className="h-[100px] w-[70px] shrink-0"
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
