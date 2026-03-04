"use client";

import Image from "next/image";
import type { Card } from "../types";
import { cardToFilename } from "../deck";
import { CARD_IMAGE_BASE } from "../constants";
import { cn } from "@/lib/utils";

type PlayingCardProps = {
  card: Card;
  faceUp?: boolean;
  onClick?: () => void;
  className?: string;
};

export function PlayingCard({
  card,
  faceUp = true,
  onClick,
  className,
}: PlayingCardProps) {
  if (!faceUp) {
    return (
      <div
        className={cn(
          "flex h-[80px] w-[56px] sm:h-[100px] sm:w-[70px] md:h-[120px] md:w-[84px] shrink-0 items-center justify-center rounded-md border-2 border-border bg-muted/80 text-muted-foreground text-xs",
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
        "relative h-[80px] w-[56px] sm:h-[100px] sm:w-[70px] md:h-[120px] md:w-[84px] shrink-0 overflow-hidden rounded-md border border-border bg-muted shadow-sm transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring",
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
