import type { Card } from "../types";
import type { GameState } from "../game-state";
import { apiFetch } from "@/lib/api";
import { normalizeCard, normalizeCards } from "@/lib/api-card-normalize";

/** Normaliserar state från API så att alla kort har suit/rank (visning + sortering). */
function apiStateToGameState(raw: Record<string, unknown>): GameState {
  const r = raw as Record<string, unknown>;
  const playerHands = (r.playerHands ?? r.PlayerHands ?? {}) as Record<string, unknown[]>;
  const normalizedHands: Record<string, Card[]> = {};
  for (const [pid, arr] of Object.entries(playerHands)) {
    normalizedHands[pid] = normalizeCards(Array.isArray(arr) ? arr : []);
  }
  const melds = (r.melds ?? r.Melds ?? []) as Array<{
    id?: string; Id?: string;
    cards?: unknown[]; Cards?: unknown[];
    type?: string; Type?: string;
    wildRepresents?: Record<string, unknown>; WildRepresents?: Record<string, unknown>;
    ownerId?: string; OwnerId?: string;
    cardContributors?: Record<string, string>; CardContributors?: Record<string, string>;
  }>;
  return {
    stock: normalizeCards((r.stock ?? r.Stock ?? []) as unknown[]),
    discard: normalizeCards((r.discard ?? r.Discard ?? []) as unknown[]),
    melds: melds.map((m) => {
      const wr = (m.wildRepresents ?? m.WildRepresents) as Record<string, Record<string, string>> | undefined;
      let wildRepresents: Record<number, Card> | undefined;
      if (wr && typeof wr === "object") {
        wildRepresents = {};
        for (const [k, v] of Object.entries(wr)) {
          const i = parseInt(k, 10);
          if (!Number.isNaN(i) && v && typeof v === "object")
            wildRepresents![i] = normalizeCard(v);
        }
        if (Object.keys(wildRepresents).length === 0) wildRepresents = undefined;
      }
      const ownerId = (m.ownerId ?? m.OwnerId) as string | undefined;
      const rawContrib = (m.cardContributors ?? m.CardContributors) as Record<string, string> | undefined;
      let cardContributors: Record<number, string> | undefined;
      if (rawContrib && typeof rawContrib === "object") {
        cardContributors = {};
        for (const [k, v] of Object.entries(rawContrib)) {
          const i = parseInt(k, 10);
          if (!Number.isNaN(i) && typeof v === "string") cardContributors![i] = v;
        }
        if (Object.keys(cardContributors).length === 0) cardContributors = undefined;
      }
      return {
        id: (m.id ?? m.Id ?? "") as string,
        cards: normalizeCards((m.cards ?? m.Cards ?? []) as unknown[]),
        type: ((m.type ?? m.Type ?? "set") as "set" | "run") ?? "set",
        ...(wildRepresents && { wildRepresents }),
        ...(ownerId && { ownerId }),
        ...(cardContributors && { cardContributors }),
      };
    }),
    currentPlayerId: (r.currentPlayerId ?? r.CurrentPlayerId ?? null) as GameState["currentPlayerId"],
    playerHands: normalizedHands,
    playerScores: (r.playerScores ?? r.PlayerScores ?? {}) as Record<string, number>,
    phase: (r.phase ?? r.Phase ?? "draw") as GameState["phase"],
    lastDraw: (r.lastDraw ?? r.LastDraw ?? null) as GameState["lastDraw"],
    cardsLaidThisTurn: (r.cardsLaidThisTurn ?? r.CardsLaidThisTurn ?? 0) as number,
    lastLaidMeldIds: (r.lastLaidMeldIds ?? r.LastLaidMeldIds) as string[] | undefined,
    roundNumber: (r.roundNumber ?? r.RoundNumber ?? 1) as number,
    winnerId: (r.winnerId ?? r.WinnerId ?? null) as GameState["winnerId"],
  };
}

export type FiveHundredStateResponse = { state: GameState; myPlayerId: string };

export type FiveHundredActionResponse = { state: GameState; lastDrawnCard?: Card | null };

export type { SessionPlayer, SessionInfo } from "@/lib/game-session-api";
export { fetchGameSession } from "@/lib/game-session-api";

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
  payload?: {
    cardIndex?: number;
    cardIndices?: number[];
    meldId?: string;
    wildRepresents?: Record<number, Card>;
    wildAs?: Card;
  }
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

export async function resetFiveHundredGame(sessionId: string): Promise<FiveHundredStateResponse | null> {
  const res = await apiFetch(`/api/gamesessions/${sessionId}/500/reset`, { method: "POST" });
  if (!res.ok) return null;
  const data = await res.json();
  const state = data.state ? apiStateToGameState(data.state as Record<string, unknown>) : null;
  const myPlayerId = data.myPlayerId ?? "p1";
  if (!state) return null;
  return { state, myPlayerId };
}
