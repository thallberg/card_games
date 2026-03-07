"use client";

type StockPileProps = {
  count: number;
  onDraw: () => void;
  disabled?: boolean;
  /** Visa grön ram när det är spelarens tur */
  isMyTurn?: boolean;
};

const CARD_CLASS =
  "h-[80px] w-[56px] sm:h-[100px] sm:w-[70px] md:h-[120px] md:w-[84px] shrink-0";

export function StockPile({ count, onDraw, disabled, isMyTurn }: StockPileProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onDraw}
        disabled={disabled || count === 0}
        className={`relative block overflow-hidden rounded-md border-2 p-0 min-h-[44px] min-w-[44px] transition-colors active:scale-95 disabled:pointer-events-none disabled:opacity-50 ${CARD_CLASS} ${
          isMyTurn
            ? "border-green-500 hover:border-green-600"
            : "border-[var(--warm-coral)]/30 hover:border-[var(--warm-coral)]/50"
        }`}
        aria-label="Dra från talongen"
      >
        <img
          src="/cardback.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      </button>
      <span className="text-muted-foreground text-xs">Talong: {count}</span>
    </div>
  );
}
