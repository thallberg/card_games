"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { GameBoard } from "./components";
import { SinglePlayerIntro } from "@/components/single-player-intro";

export function FiveHoundredClient() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") ?? undefined;
  const [playerCount, setPlayerCount] = useState<number | null>(sessionId ? 2 : null);

  // Single player: gemensam intro-sida för att välja antal spelare (2–6)
  if (!sessionId && playerCount === null) {
    return (
      <SinglePlayerIntro
        title="500 – single player"
        description="Välj antal spelare (2–6). Du spelar som spelare 1, övriga är datorstyrda motståndare."
        minPlayers={2}
        maxPlayers={6}
        onSelect={(n) => setPlayerCount(n)}
        note="Vill du spela 500 med vänner? Skapa ett spel via"
      />
    );
  }

  return <GameBoard sessionId={sessionId} />;
}
