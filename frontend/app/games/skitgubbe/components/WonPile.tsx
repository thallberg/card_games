"use client";

type WonPileProps = {
  count: number;
  label: string;
};

/** Hög med vunna kort – samma stil som StockPile. */
export function WonPile({ count, label }: WonPileProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="flex h-[80px] w-[56px] sm:h-[100px] sm:w-[70px] md:h-[120px] md:w-[84px] shrink-0 items-center justify-center rounded-md border-2 border-dashed border-[var(--warm-sage)]/40 bg-[var(--warm-sage)]/20 text-muted-foreground min-h-[44px] min-w-[44px]"
        aria-label={`${label}: ${count} kort`}
      >
        <span className="text-sm font-medium">{count}</span>
      </div>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}
