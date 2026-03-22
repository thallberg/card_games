"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { GameBoard } from "./components";
import { GameSinglePlayerIntro } from "@/components/game-single-player-intro";

export function FiveHoundredClient() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") ?? undefined;
  const [playerCount, setPlayerCount] = useState<number | null>(sessionId ? 2 : null);

  if (!sessionId && playerCount === null) {
    return (
      <GameSinglePlayerIntro
        gameId="fivehoundred"
        onSelect={(n) => setPlayerCount(n)}
      />
    );
  }

  return <GameBoard sessionId={sessionId} playerCount={sessionId ? undefined : (playerCount ?? 2)} />;
}
