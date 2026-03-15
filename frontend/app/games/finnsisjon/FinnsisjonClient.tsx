"use client";

import { useSearchParams } from "next/navigation";
import { GameBoard } from "./components";

export function FinnsisjonClient() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") ?? undefined;
  return <GameBoard sessionId={sessionId} />;
}
