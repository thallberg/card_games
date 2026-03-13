"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type SinglePlayerIntroProps = {
  title: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  onSelect: (count: number) => void;
  note?: string;
};

export function SinglePlayerIntro({
  title,
  description,
  minPlayers,
  maxPlayers,
  onSelect,
  note,
}: SinglePlayerIntroProps) {
  const options = Array.from({ length: maxPlayers - minPlayers + 1 }, (_, i) => i + minPlayers);

  return (
    <main className="flex-1 p-3 sm:p-6 min-h-0 overflow-auto">
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 px-1 sm:px-0">
        <div className="space-y-2">
          <h1 className="text-lg sm:text-xl font-semibold">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map((n) => (
            <Button key={n} onClick={() => onSelect(n)}>
              {n} spelare
            </Button>
          ))}
        </div>
        {note && (
          <p className="text-muted-foreground text-xs">
            {note}{" "}
            <Link href="/spel" className="underline underline-offset-4 hover:text-foreground">
              Mina spel
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}

