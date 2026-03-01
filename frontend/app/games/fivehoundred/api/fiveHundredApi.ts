import type { GameState } from "../game-state";
import { apiFetch } from "@/lib/api";

/** API returnerar samma struktur (camelCase). Cast till vår typ. */
function apiStateToGameState(raw: Record<string, unknown>): GameState {
  return raw as unknown as GameState;
}

export type FiveHundredStateResponse = { state: GameState; myPlayerId: string };

export async function fetchFiveHundredState(sessionId: string): Promise<FiveHundredStateResponse | null> {
  const res = await apiFetch(`/api/gamesessions/${sessionId}/500/state`);
  if (!res.ok) return null;
  const data = await res.json();
  const state = data.state ? apiStateToGameState(data.state) : null;
  const myPlayerId = data.myPlayerId ?? "p1";
  if (!state) return null;
  return { state, myPlayerId };
}

export async function sendFiveHundredAction(
  sessionId: string,
  action: string,
  payload?: { cardIndex?: number; cardIndices?: number[]; meldId?: string }
): Promise<GameState | null> {
  const res = await apiFetch(`/api/gamesessions/${sessionId}/500/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data ? apiStateToGameState(data) : null;
}
