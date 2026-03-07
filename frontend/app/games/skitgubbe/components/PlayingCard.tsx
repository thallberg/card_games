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
  selected?: boolean;
  dimmed?: boolean;
  highlight?: boolean;
};

export function PlayingCard({
  card,
  faceUp = true,
  onClick,
  className,
  selected,
  dimmed,
  highlight,
}: PlayingCardProps) {
  if (!faceUp) {
    return (
      <div
        className={cn(
          "flex h-[72px] w-[50px] sm:h-[88px] sm:w-[62px] md:h-[100px] md:w-[70px] shrink-0 items-center justify-center rounded-md border-2 border-border bg-muted/80 text-muted-foreground text-xs",
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
        "relative h-[72px] w-[50px] sm:h-[88px] sm:w-[62px] md:h-[100px] md:w-[70px] shrink-0 overflow-hidden rounded-md border-2 bg-muted shadow-sm transition-transform focus:outline-none focus:ring-2 focus:ring-ring",
        selected ? "border-primary ring-2 ring-primary ring-offset-2" : "border-border",
        highlight && "ring-2 ring-green-500 ring-offset-2 border-green-500",
        dimmed && "cursor-not-allowed opacity-50",
        !dimmed && "hover:scale-105",
        className
      )}
      disabled={!onClick}
    >
      <Image
        src={src}
        alt={`${card.rank} ${card.suit}`}
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
