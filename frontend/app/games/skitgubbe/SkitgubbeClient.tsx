"use client";

import { useSearchParams } from "next/navigation";
import { GameBoard } from "./components";

export function SkitgubbeClient() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") ?? undefined;
  return <GameBoard sessionId={sessionId} />;
}
