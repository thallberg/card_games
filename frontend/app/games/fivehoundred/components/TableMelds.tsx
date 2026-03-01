"use client";

import { useState } from "react";
import type { Meld } from "../types";
import { getMeldDisplayCards } from "../melds";
import { PlayingCard } from "./PlayingCard";
import { AllMeldsModal } from "./AllMeldsModal";

const RECENT_MELDS_COUNT = 3;

type TableMeldsProps = {
  melds: Meld[];
};

export function TableMelds({ melds }: TableMeldsProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const recentMelds = melds.slice(-RECENT_MELDS_COUNT);
  const displayCards = (m: Meld) => getMeldDisplayCards(m);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setModalOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setModalOpen(true);
          }
        }}
        className="w-full min-h-[140px] cursor-pointer rounded-lg border border-dashed border-muted-foreground/20 bg-muted/10 p-4 text-left transition-colors hover:border-muted-foreground/40 hover:bg-muted/20 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {recentMelds.length === 0 ? (
          <p className="text-muted-foreground text-center text-sm">
            Inga kombinationer utlagda än. Klicka för att öppna när det finns.
          </p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {recentMelds.map((meld) => (
              <div
                key={meld.id}
                className="flex items-center gap-0.5 rounded-md border border-border bg-card p-2"
              >
                {displayCards(meld).map((card, i) => (
                  <PlayingCard
                    key={`${meld.id}-${i}`}
                    card={card}
                    faceUp
                    className="h-[80px] w-[56px]"
                  />
                ))}
              </div>
            ))}
          </div>
        )}
        {melds.length > 0 && (
          <p className="text-muted-foreground mt-2 text-center text-xs">
            Visar 3 senaste. Klicka för att se alla {melds.length} utlagda.
          </p>
        )}
      </div>

      <AllMeldsModal
        melds={melds}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
