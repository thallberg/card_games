import type { Card } from "../types";
import type { GameState } from "../game-state";
import { apiFetch } from "@/lib/api";

/** Normalisera kort från API (suit/rank eller Suit/Rank). */
function normalizeCard(raw: { suit?: string; rank?: string; Suit?: string; Rank?: string }): Card {
  return {
    suit: (raw.suit ?? raw.Suit ?? "hearts") as Card["suit"],
    rank: (raw.rank ?? raw.Rank ?? "2") as Card["rank"],
  };
}

function normalizeCards(arr: unknown[]): Card[] {
  return arr.map((c) => normalizeCard((c as Record<string, string>) ?? {}));
}

function normalizeRecordOfCards(obj: Record<string, unknown>): Record<string, Card[]> {
  const out: Record<string, Card[]> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = normalizeCards(Array.isArray(v) ? v : []);
  }
  return out;
}

/** Konvertera API-state till frontend GameState. */
export function apiStateToGameState(raw: Record<string, unknown>): GameState {
  const r = raw as Record<string, unknown>;
  const playerHands = (r.playerHands ?? {}) as Record<string, unknown[]>;
  const wonCards = (r.wonCards ?? {}) as Record<string, unknown[]>;
  const sticksWon = (r.sticksWon ?? {}) as Record<string, number>;
  const tableStick = ((r.tableStick ?? []) as unknown[]).map((sc) => {
    const x = sc as { playerId: string; card: unknown };
    return { playerId: x.playerId as GameState["playerIds"][number], card: normalizeCard((x.card ?? {}) as Record<string, string>) };
  });
  const tableTrick = ((r.tableTrick ?? []) as unknown[]).map((tc) => {
    const x = tc as { playerId: string; card: unknown };
    return { playerId: x.playerId as GameState["playerIds"][number], card: normalizeCard((x.card ?? {}) as Record<string, string>) };
  });
  const lastRevealed = r.lastRevealedCard != null ? normalizeCard((r.lastRevealedCard as Record<string, string>) ?? {}) : null;
  return {
    phase: (r.phase ?? "sticks") as GameState["phase"],
    numPlayers: (r.numPlayers as number) ?? 2,
    playerIds: Array.isArray(r.playerIds) ? (r.playerIds as GameState["playerIds"]) : ["p1", "p2"],
    stock: normalizeCards((r.stock ?? []) as unknown[]),
    playerHands: normalizeRecordOfCards(playerHands as Record<string, unknown>),
    lastRevealedCard: lastRevealed as GameState["lastRevealedCard"],
    trumpSuit: (r.trumpSuit as GameState["trumpSuit"]) ?? null,
    lastStickWinner: (r.lastStickWinner as GameState["lastStickWinner"]) ?? null,
    tableStick,
    stickLedRank: (r.stickLedRank as GameState["stickLedRank"]) ?? null,
    playersMustPlay: Array.isArray(r.playersMustPlay) ? (r.playersMustPlay as GameState["playersMustPlay"]) : [],
    stickFighters: Array.isArray(r.stickFighters) ? (r.stickFighters as GameState["stickFighters"]) : [],
    currentPlayerId: (r.currentPlayerId as GameState["currentPlayerId"]) ?? "p1",
    sticksWon: sticksWon as Record<string, number>,
    wonCards: normalizeRecordOfCards(wonCards as Record<string, unknown>),
    humanPendingKlar: (r.humanPendingKlar as boolean) ?? false,
    nextPlayerIdAfterKlar: (r.nextPlayerIdAfterKlar as GameState["nextPlayerIdAfterKlar"]) ?? null,
    stickShowingWinner: (r.stickShowingWinner as GameState["stickShowingWinner"]) ?? null,
    tableTrick,
    trickLeader: (r.trickLeader as GameState["trickLeader"]) ?? null,
    trickLeadLength: (r.trickLeadLength as number) ?? 0,
    trickPlayLengths: Array.isArray(r.trickPlayLengths) ? (r.trickPlayLengths as number[]) : [],
    trickLeadSuit: (r.trickLeadSuit as GameState["trickLeadSuit"]) ?? null,
    trickHighRank: (r.trickHighRank as GameState["trickHighRank"]) ?? null,
    trumpPlayedInTrick: (r.trumpPlayedInTrick as boolean) ?? false,
    winnerId: (r.winnerId as GameState["winnerId"]) ?? null,
    skitgubbePlayerId: (r.skitgubbePlayerId as GameState["skitgubbePlayerId"]) ?? null,
    trickShowingWinner: (r.trickShowingWinner as GameState["trickShowingWinner"]) ?? null,
    trickPickUpBy: (r.trickPickUpBy as GameState["trickPickUpBy"]) ?? null,
  };
}

export type SkitgubbeStateResponse = { state: GameState; myPlayerId: string };

export type SessionInfo = { id: string; status: string; players: { userId: string }[] };

export async function fetchGameSession(sessionId: string): Promise<SessionInfo | null> {
  const res = await apiFetch(`/api/gamesessions/${sessionId}`);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data as SessionInfo;
}

export async function fetchSkitgubbeState(sessionId: string): Promise<SkitgubbeStateResponse | null> {
  const res = await apiFetch(`/api/gamesessions/${sessionId}/skitgubbe/state`);
  if (!res.ok) return null;
  const data = await res.json();
  const state = data.state ? apiStateToGameState(data.state as Record<string, unknown>) : null;
  const myPlayerId = data.myPlayerId ?? "p1";
  if (!state) return null;
  return { state, myPlayerId };
}

export async function sendSkitgubbeAction(sessionId: string, newState: GameState): Promise<SkitgubbeStateResponse | null> {
  const res = await apiFetch(`/api/gamesessions/${sessionId}/skitgubbe/action`, {
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
