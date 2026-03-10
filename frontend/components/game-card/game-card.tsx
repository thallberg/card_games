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
import { cn } from "@/lib/utils";

type GameCardProps = {
  game: GameCardData;
};

/**
 * Visar ett kortspel som ett klickbart kort med shadcn Card.
 * Samma storlek och utseende för alla spel.
 */
export function GameCard({ game }: GameCardProps) {
  const description = game.shortDescription ?? game.description;

  return (
    <Link
      href={game.path}
      className={cn(
        "block h-full text-foreground no-underline outline-none",
        "transition-colors duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
    >
      <Card className="h-full min-h-[200px] flex flex-col gap-2 py-4 cursor-pointer transition-colors duration-200 hover:bg-accent/50">
        <CardHeader className="flex-1 gap-1 px-4 pb-0 pt-0">
          <CardTitle className="text-lg">{game.title}</CardTitle>
          <CardDescription className="line-clamp-2">{description}</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pt-0 pb-0">
          <span className="text-muted-foreground text-sm">Klicka för att spela →</span>
        </CardContent>
      </Card>
    </Link>
  );
}
