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
  size?: "sm" | "md";
};

export function PlayingCard({
  card,
  faceUp = true,
  onClick,
  className,
  size = "md",
}: PlayingCardProps) {
  const sizeClass = size === "sm" ? "h-[72px] w-[50px]" : "h-[120px] w-[84px]";
  if (!faceUp) {
    return (
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
        "relative shrink-0 overflow-hidden rounded-md border border-border bg-muted shadow-sm transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring",
        sizeClass,
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
