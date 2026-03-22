import type { GameState } from "../game-state";
import type { Card } from "../types";
import { apiFetch } from "@/lib/api";
import { normalizeCard, normalizeCards } from "@/lib/api-card-normalize";

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeState(raw: Record<string, unknown>): GameState {
  const r = raw as Record<string, unknown>;
  const playerHands = (r.playerHands ?? {}) as Record<string, unknown[]>;
  const hands: Record<string, Card[]> = {};
  for (const [pid, arr] of Object.entries(playerHands))
    hands[pid as "p1" | "p2"] = normalizeCards(Array.isArray(arr) ? arr : []);

  const playPhaseHands = (r.playPhaseHands ?? {}) as Record<string, unknown[]>;
  const phaseHands: Record<string, Card[]> = {};
  for (const [pid, arr] of Object.entries(playPhaseHands))
    phaseHands[pid as "p1" | "p2"] = normalizeCards(Array.isArray(arr) ? arr : []);

  const drawPick = r.drawPick;
  let drawPickNorm: GameState["drawPick"] = null;
  if (drawPick && typeof drawPick === "object" && drawPick !== null) {
    const d = drawPick as Record<string, unknown>;
    drawPickNorm = {
      openCard: normalizeCard((d.openCard as Record<string, string>) ?? {}),
      hiddenCard: normalizeCard((d.hiddenCard as Record<string, string>) ?? {}),
      picksLeft: Number(d.picksLeft) ?? 0,
      tempHand: normalizeCards((d.tempHand as unknown[]) ?? []),
      isFreeSwap: Boolean(d.isFreeSwap),
    };
  }

  const completedTricks = (r.completedTricks ?? []) as Array<{
    leaderCard?: Record<string, string>;
    followerCard?: Record<string, string>;
    trickLeader?: string;
    winner?: string;
  }>;
  const tricks = completedTricks.map((t) => ({
    leaderCard: normalizeCard(t.leaderCard ?? {}),
    followerCard: normalizeCard(t.followerCard ?? {}),
    trickLeader: (t.trickLeader ?? "p1") as "p1" | "p2",
    winner: (t.winner ?? "p1") as "p1" | "p2",
  }));

  const trickCardsRaw = r.trickCards;
  let trickCards: [Card, Card | null] | null = null;
  if (Array.isArray(trickCardsRaw) && trickCardsRaw.length >= 1)
    trickCards = [normalizeCard((trickCardsRaw[0] as Record<string, string>) ?? {}), trickCardsRaw[1] != null ? normalizeCard((trickCardsRaw[1] as Record<string, string>) ?? {}) : null];

  return {
    phase: (r.phase ?? "draw") as GameState["phase"],
    deck: normalizeCards((r.deck ?? []) as unknown[]),
    playerHands: hands,
    drawRound: num(r.drawRound, 0),
    drawPick: drawPickNorm,
    freeSwapUsedCount: Number(r.freeSwapUsedCount) ?? 0,
    currentPlayerId: (r.currentPlayerId ?? "p1") as "p1" | "p2",
    trickNumber: num(r.trickNumber, 0),
    trickLeader: (r.trickLeader ?? "p2") as "p1" | "p2",
    trickCards,
    completedTricks: tricks,
    playerScores: (r.playerScores ?? { p1: 0, p2: 0 }) as Record<string, number>,
    roundUtspeletWinner: (r.roundUtspeletWinner ?? null) as "p1" | "p2" | null,
    roundHandPoints: (r.roundHandPoints ?? { p1: 0, p2: 0 }) as Record<string, number>,
    playPhaseHands: phaseHands,
    rondNumber: num(r.rondNumber, 1),
  };
}

export type ChicagoStateResponse = { state: GameState; myPlayerId: string };

export async function fetchChicagoState(sessionId: string): Promise<ChicagoStateResponse | null> {
  const res = await apiFetch(`/api/gamesessions/${sessionId}/chicago/state`);
  if (!res.ok) return null;
  const data = await res.json();
  const state = data.state ? normalizeState(data.state as Record<string, unknown>) : null;
  const myPlayerId = data.myPlayerId ?? "p1";
  if (!state) return null;
  return { state, myPlayerId };
}

export async function sendChicagoAction(
  sessionId: string,
  newStateJson: string
): Promise<ChicagoStateResponse | null> {
  const res = await apiFetch(`/api/gamesessions/${sessionId}/chicago/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newStateJson }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.state) return null;
  return {
    state: normalizeState(data.state as Record<string, unknown>),
    myPlayerId: data.myPlayerId ?? "p1",
  };
}

export async function startChicagoNewRound(sessionId: string): Promise<ChicagoStateResponse | null> {
  const res = await apiFetch(`/api/gamesessions/${sessionId}/chicago/start-round`, {
    method: "POST",
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.state) return null;
  return {
    state: normalizeState(data.state as Record<string, unknown>),
    myPlayerId: data.myPlayerId ?? "p1",
  };
}
