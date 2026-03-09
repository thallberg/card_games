"use client";

type WonPileProps = {
  count: number;
  label: string;
};

const CARD_CLASS =
  "h-[80px] w-[56px] sm:h-[100px] sm:w-[70px] md:h-[120px] md:w-[84px] shrink-0";

/** Hög med vunna kort – kortbaksida från public (samma som talongen). */
export function WonPile({ count, label }: WonPileProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`relative flex ${CARD_CLASS} min-h-[44px] min-w-[44px] items-center justify-center overflow-hidden rounded-md border-2 border-[var(--border)]`}
        aria-label={`${label}: ${count} kort`}
      >
        <img
          src="/cardback.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span className="relative z-10 text-sm font-medium text-foreground drop-shadow-sm">
          {count}
        </span>
      </div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-muted-foreground text-xs font-medium">{count} kort</span>
    </div>
  );
}
