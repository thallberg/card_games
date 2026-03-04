"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GameCardData } from "@/data-content/games";

type GameCardProps = {
  game: GameCardData;
};

/**
 * Visar ett kortspel som ett klickbart kort.
 * Vid klick navigeras användaren till spelets sida.
 */
export function GameCard({ game }: GameCardProps) {
  const description = game.shortDescription ?? game.description;

  return (
    <Link href={game.path} className="block transition-opacity hover:opacity-90">
      <Card className="h-full cursor-pointer border-[var(--border)] transition-all hover:shadow-lg hover:border-[var(--warm-coral)]/40 hover:bg-[var(--warm-cream)]/50">
        <CardHeader>
          <CardTitle>{game.title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <span className="text-muted-foreground text-sm">Klicka för att spela →</span>
        </CardContent>
      </Card>
    </Link>
  );
}
