import type { Card, Rank } from "../types";
import type { GameState, TableauPile } from "../game-state";
import { apiFetch } from "@/lib/api";

function normalizeCard(raw: { suit?: string; rank?: string; Suit?: string; Rank?: string }): Card {
  return {
    suit: (raw.suit ?? raw.Suit ?? "hearts") as Card["suit"],
    rank: (raw.rank ?? raw.Rank ?? "2") as Card["rank"],
  };
}

function normalizeCards(arr: unknown[]): Card[] {
  return (arr ?? []).map((c) => normalizeCard((c as Record<string, string>) ?? {}));
}

function normalizeRecordOfCards(obj: Record<string, unknown>): Record<string, Card[]> {
  const out: Record<string, Card[]> = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    out[k] = normalizeCards(Array.isArray(v) ? v : []);
  }
  return out;
}

function normalizeTableau(raw: unknown): TableauPile[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((pile) => normalizeCards(Array.isArray(pile) ? pile : []));
}

/** Konvertera API-state till frontend GameState. */
export function apiStateToGameState(raw: Record<string, unknown>): GameState {
  const r = raw as Record<string, unknown>;
  const playerHands = (r.playerHands ?? {}) as Record<string, unknown[]>;
  const quartetsWon = (r.quartetsWon ?? {}) as Record<string, number>;
  const lastAskRaw = r.lastAsk;
  const lastAsk =
    lastAskRaw != null && typeof lastAskRaw === "object" && "from" in lastAskRaw && "to" in lastAskRaw && "rank" in lastAskRaw
      ? {
          from: (lastAskRaw as { from: string }).from as GameState["playerIds"][number],
          to: (lastAskRaw as { to: string }).to as GameState["playerIds"][number],
          rank: (lastAskRaw as { rank: string }).rank as Rank,
        }
      : null;
  const sjönRaw = r.sjön ?? r.sjon;
  const sjön = Array.isArray(sjönRaw) ? normalizeCards(sjönRaw) : [];
  const tableau = normalizeTableau(r.tableau);

  return {
    phase: (r.phase ?? "play") as GameState["phase"],
    numPlayers: (r.numPlayers as number) ?? 2,
    playerIds: Array.isArray(r.playerIds) ? (r.playerIds as GameState["playerIds"]) : ["p1", "p2"],
    tableau,
    sjön,
    playerHands: normalizeRecordOfCards(playerHands as Record<string, unknown>),
    quartetsWon: quartetsWon as Record<string, number>,
    currentPlayerId: (r.currentPlayerId as GameState["currentPlayerId"]) ?? "p1",
    lastAsk,
    lastWasFinnsISjon: (r.lastWasFinnsISjon as boolean) ?? false,
    winnerId: (r.winnerId as GameState["winnerId"]) ?? null,
  };
}

export type FinnsisjonStateResponse = { state: GameState; myPlayerId: string };

export type SessionPlayer = { userId: string; displayName: string; seatOrder: number; avatarEmoji?: string | null };
export type SessionInfo = { id: string; status: string; players: SessionPlayer[] };

export async function fetchGameSession(sessionId: string): Promise<SessionInfo | null> {
  const res = await apiFetch(`/api/gamesessions/${sessionId}`);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data || !Array.isArray(data.players)) return data as SessionInfo;
  const players: SessionPlayer[] = data.players.map((p: { userId?: string; UserId?: string; displayName?: string; DisplayName?: string; seatOrder?: number; SeatOrder?: number; avatarEmoji?: string | null; AvatarEmoji?: string | null }) => ({
    userId: String(p.userId ?? p.UserId ?? ""),
    displayName: String(p.displayName ?? p.DisplayName ?? "").trim() || "Spelare",
    seatOrder: Number(p.seatOrder ?? p.SeatOrder ?? 0),
    avatarEmoji: p.avatarEmoji ?? p.AvatarEmoji ?? null,
  }));
  const status = (data.status ?? data.Status ?? "").toString();
  return { ...data, status, players } as SessionInfo;
}

export async function fetchFinnsisjonState(sessionId: string): Promise<FinnsisjonStateResponse | null> {
  try {
    const res = await apiFetch(`/api/gamesessions/${sessionId}/finnsisjon/state`);
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data?.state) return null;
    const state = apiStateToGameState(data.state as Record<string, unknown>);
    const myPlayerId = data.myPlayerId ?? "p1";
    return { state, myPlayerId };
  } catch {
    return null;
  }
}

export async function sendFinnsisjonAction(sessionId: string, newState: GameState): Promise<FinnsisjonStateResponse | null> {
  const res = await apiFetch(`/api/gamesessions/${sessionId}/finnsisjon/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newStateJson: JSON.stringify(newState) }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const state = data.state ? apiStateToGameState(data.state as Record<string, unknown>) : null;
  const myPlayerId = data.myPlayerId ?? "p1";
  if (!state) return null;
  return { state, myPlayerId };
}
