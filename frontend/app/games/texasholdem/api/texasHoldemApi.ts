import { apiFetch } from "@/lib/api";

export async function fetchTexasHoldemState(sessionId: string): Promise<{
  state: unknown;
  mySeatIndex: number;
  waitingForStart?: boolean;
} | null> {
  const res = await apiFetch(`/api/gamesessions/${sessionId}/texasholdem/state`);
  if (res.status === 404)
    return { state: null, mySeatIndex: 0, waitingForStart: true };
  if (!res.ok) return null;
  const data = await res.json();
  return { state: data.state, mySeatIndex: data.mySeatIndex ?? 0 };
}

export async function sendTexasHoldemAction(
  sessionId: string,
  action: string,
  stateJson: string
): Promise<{ ok: boolean; state?: unknown }> {
  const res = await apiFetch(`/api/gamesessions/${sessionId}/texasholdem/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "saveState", stateJson }),
  });
  if (!res.ok) return { ok: false };
  const data = await res.json();
  return { ok: true, state: data.state };
}
