"use client";

import Image from "next/image";
import type { Card } from "@/lib/cards";
import { cardToFilename, CARD_IMAGE_BASE } from "@/lib/cards";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  default:
    "h-[72px] w-[50px] sm:h-[88px] sm:w-[62px] md:h-[100px] md:w-[70px]",
  sm: "h-[56px] w-[39px] sm:h-[72px] sm:w-[50px]",
  md: "h-[80px] w-[56px] sm:h-[100px] sm:w-[70px] md:h-[120px] md:w-[84px]",
} as const;

type PlayingCardProps = {
  card: Card;
  faceUp?: boolean;
  onClick?: () => void;
  className?: string;
  /** Size preset. Default = chicago/skitgubbe; sm = small (e.g. table); md = large. */
  size?: keyof typeof SIZE_CLASSES;
  /** Face-down: "question" = ? placeholder, "cardback" = card back image. */
  faceDownVariant?: "question" | "cardback";
  selected?: boolean;
  /** Dimmed when player cannot play this card (e.g. must follow suit). */
  dimmed?: boolean;
  /** Green highlight (e.g. cards in pair/set at round end). */
  highlight?: boolean;
};

export function PlayingCard({
  card,
  faceUp = true,
  onClick,
  className,
  size = "default",
  faceDownVariant = "question",
  selected,
  dimmed,
  highlight,
}: PlayingCardProps) {
  const sizeClass = SIZE_CLASSES[size];

  if (!faceUp) {
    const baseClass = cn(
      "relative shrink-0 overflow-hidden rounded-md border-2 border-border shadow-sm focus:outline-none focus:ring-2 focus:ring-ring",
      sizeClass,
      onClick && "cursor-pointer hover:scale-105 hover:border-primary transition-transform",
      className
    );
    if (faceDownVariant === "cardback") {
      return onClick ? (
        <button type="button" onClick={onClick} className={baseClass}>
          <Image
            src="/cardback.png"
            alt=""
            fill
            className="object-cover"
            unoptimized
          />
        </button>
      ) : (
        <div className={baseClass}>
          <Image
            src="/cardback.png"
            alt=""
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      );
    }
    return onClick ? (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md border-2 border-border bg-muted/80 text-muted-foreground text-xs",
          sizeClass,
          "cursor-pointer hover:border-primary",
          className
        )}
      >
        ?
      </button>
    ) : (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md border-2 border-border bg-muted/80 text-muted-foreground text-xs",
          sizeClass,
          className
        )}
      >
        ?
      </div>
    );
  }

  const src = `${CARD_IMAGE_BASE}/${cardToFilename(card)}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md border-2 bg-muted shadow-sm transition-transform focus:outline-none focus:ring-2 focus:ring-ring",
        sizeClass,
        "border-border",
        selected && "border-primary",
        !selected && highlight && "border-green-500",
        dimmed && "cursor-not-allowed opacity-50",
        !dimmed && "hover:scale-105 hover:border-primary",
        className
      )}
      disabled={!onClick}
    >
      <Image
        src={src}
        alt={`${card.rank} of ${card.suit}`}
        fill
        className="object-contain"
        unoptimized
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    </button>
  );
}
