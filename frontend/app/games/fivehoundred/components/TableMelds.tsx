"use client";

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

type TableMeldsProps = {
  melds: Meld[];
};

export function TableMelds({ melds }: TableMeldsProps) {
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
              {getMeldDisplayCards(meld).map((item, i) => (
                <div key={`${meld.id}-${i}`} className="flex flex-col items-center">
                  <PlayingCard
                    card={item.card}
                    faceUp
                    className="h-[100px] w-[70px] shrink-0"
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
    </div>
  );
}
