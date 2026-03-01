"use client";

import { PlayingCard } from "./PlayingCard";

type StockPileProps = {
  count: number;
  onDraw: () => void;
  disabled?: boolean;
};

export function StockPile({ count, onDraw, disabled }: StockPileProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onDraw}
        disabled={disabled || count === 0}
        className="flex h-[120px] w-[84px] shrink-0 items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/30 bg-muted/50 text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:bg-muted/80 disabled:pointer-events-none disabled:opacity-50"
        aria-label="Dra från talongen"
      >
        <span className="text-sm font-medium">{count}</span>
      </button>
      <span className="text-muted-foreground text-xs">Talong</span>
    </div>
  );
}
