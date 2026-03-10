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
 * Visar ett kortspel med shadcn Card. Länk till spel + länk "Bjud in vänner" till vänlistan med rätt speltyp.
 */
export function GameCard({ game }: GameCardProps) {
  const description = game.shortDescription ?? game.description;
  const inviteUrl = `/vanner?inviteGame=${encodeURIComponent(game.id)}`;

  return (
    <Card className="h-full min-h-[200px] flex flex-col gap-2 py-4 transition-colors duration-200 hover:bg-accent/50">
      <CardHeader className="flex-1 gap-1 px-4 pb-0 pt-0">
        <CardTitle className="text-lg">{game.title}</CardTitle>
        <CardDescription className="line-clamp-2">{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pt-0 pb-0 flex items-center justify-between gap-2">
        <Link
          href={game.path}
          className={cn(
            "text-muted-foreground text-sm hover:opacity-90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
          )}
        >
          Klicka för att spela →
        </Link>
        <Link
          href={inviteUrl}
          className={cn(
            "text-sm font-medium text-primary underline underline-offset-2 hover:opacity-80 shrink-0",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
          )}
        >
          Bjud in vänner
        </Link>
      </CardContent>
    </Card>
  );
}
