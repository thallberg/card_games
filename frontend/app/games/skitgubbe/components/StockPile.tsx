"use client";

import Image from "next/image";

type StockPileProps = {
  count: number;
  onDraw?: () => void;
  disabled?: boolean;
};

/** Högen – kortbaksida som 500. */
export function StockPile({ count, onDraw, disabled }: StockPileProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onDraw}
        disabled={disabled || count === 0}
        className="relative block overflow-hidden rounded-md border-2 p-0 min-h-[44px] min-w-[44px] h-[80px] w-[56px] sm:h-[100px] sm:w-[70px] md:h-[120px] md:w-[84px] shrink-0 border-[var(--warm-coral)]/30 hover:border-[var(--warm-coral)]/50 transition-colors active:scale-95 disabled:pointer-events-none disabled:opacity-50"
        aria-label="Plocka från högen"
      >
        <Image
          src="/cardback.png"
          alt=""
          fill
          className="object-cover"
          unoptimized
        />
      </button>
      <span className="text-muted-foreground text-xs">Högen: {count}</span>
    </div>
  );
}
