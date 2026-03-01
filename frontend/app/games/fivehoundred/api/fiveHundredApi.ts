import type { Card } from "../types";
import type { GameState } from "../game-state";
import { apiFetch } from "@/lib/api";

/** API kan skicka suit/rank eller Suit/Rank – normalisera till camelCase. */
function normalizeCard(raw: { suit?: string; rank?: string; Suit?: string; Rank?: string }): Card {
  return {
    suit: (raw.suit ?? raw.Suit ?? "hearts") as Card["suit"],
    rank: (raw.rank ?? raw.Rank ?? "2") as Card["rank"],
  };
}

function normalizeCards(arr: unknown[]): Card[] {
  return arr.map((c) => normalizeCard((c as Record<string, string>) ?? {}));
}

/** Normaliserar state från API så att alla kort har suit/rank (visning + sortering). */
function apiStateToGameState(raw: Record<string, unknown>): GameState {
  const r = raw as Record<string, unknown>;
  const playerHands = (r.playerHands ?? r.PlayerHands ?? {}) as Record<string, unknown[]>;
  const normalizedHands: Record<string, Card[]> = {};
  for (const [pid, arr] of Object.entries(playerHands)) {
    normalizedHands[pid] = normalizeCards(Array.isArray(arr) ? arr : []);
  }
  const melds = (r.melds ?? r.Melds ?? []) as Array<{ id?: string; Id?: string; cards?: unknown[]; Cards?: unknown[]; type?: string; Type?: string }>;
  return {
    stock: normalizeCards((r.stock ?? r.Stock ?? []) as unknown[]),
    discard: normalizeCards((r.discard ?? r.Discard ?? []) as unknown[]),
    melds: melds.map((m) => ({
      id: (m.id ?? m.Id ?? "") as string,
      cards: normalizeCards((m.cards ?? m.Cards ?? []) as unknown[]),
      type: ((m.type ?? m.Type ?? "set") as "set" | "run") ?? "set",
    })),
    currentPlayerId: (r.currentPlayerId ?? r.CurrentPlayerId ?? null) as GameState["currentPlayerId"],
    playerHands: normalizedHands,
    playerScores: (r.playerScores ?? r.PlayerScores ?? {}) as Record<string, number>,
    phase: (r.phase ?? r.Phase ?? "draw") as GameState["phase"],
    lastDraw: (r.lastDraw ?? r.LastDraw ?? null) as GameState["lastDraw"],
    roundNumber: (r.roundNumber ?? r.RoundNumber ?? 1) as number,
    winnerId: (r.winnerId ?? r.WinnerId ?? null) as GameState["winnerId"],
  };
}

export type FiveHundredStateResponse = { state: GameState; myPlayerId: string };

export type FiveHundredActionResponse = { state: GameState; lastDrawnCard?: Card | null };

export async function fetchFiveHundredState(sessionId: string): Promise<FiveHundredStateResponse | null> {
  const res = await apiFetch(`/api/gamesessions/${sessionId}/500/state`);
  if (!res.ok) return null;
  const data = await res.json();
  const state = data.state ? apiStateToGameState(data.state as Record<string, unknown>) : null;
  const myPlayerId = data.myPlayerId ?? "p1";
  if (!state) return null;
  return { state, myPlayerId };
}

export async function sendFiveHundredAction(
  sessionId: string,
  action: string,
  payload?: { cardIndex?: number; cardIndices?: number[]; meldId?: string }
): Promise<FiveHundredActionResponse | null> {
  const res = await apiFetch(`/api/gamesessions/${sessionId}/500/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.state) return null;
  return {
    state: apiStateToGameState(data.state as Record<string, unknown>),
    lastDrawnCard: data.lastDrawnCard != null ? normalizeCard(data.lastDrawnCard as Record<string, string>) : null,
  };
}

export async function startFiveHundredNewRound(sessionId: string): Promise<FiveHundredStateResponse | null> {
  const res = await apiFetch(`/api/gamesessions/${sessionId}/500/start-round`, { method: "POST" });
  if (!res.ok) return null;
  const data = await res.json();
  const state = data.state ? apiStateToGameState(data.state as Record<string, unknown>) : null;
  const myPlayerId = data.myPlayerId ?? "p1";
  if (!state) return null;
  return { state, myPlayerId };
}
