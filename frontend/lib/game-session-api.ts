import { apiFetch } from "@/lib/api";

export type SessionPlayer = { userId: string; displayName: string; seatOrder: number; avatarEmoji?: string | null };
export type SessionInfo = { id: string; status: string; players: SessionPlayer[] };

function normalizeSessionPlayer(p: any): SessionPlayer {
  const userId = String(p?.userId ?? p?.UserId ?? "");
  const displayName = (String(p?.displayName ?? p?.DisplayName ?? "").trim() || "Spelare") as string;
  const seatOrder = Number(p?.seatOrder ?? p?.SeatOrder ?? 0);
  const avatarEmoji = p?.avatarEmoji ?? p?.AvatarEmoji ?? null;
  return { userId, displayName, seatOrder, avatarEmoji };
}

export async function fetchGameSession(sessionId: string): Promise<SessionInfo | null> {
  const res = await apiFetch(`/api/gamesessions/${sessionId}`);
  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  if (!data) return null;

  const playersRaw = Array.isArray(data.players) ? data.players : [];
  const players = playersRaw.map(normalizeSessionPlayer);

  const status = String(data.status ?? data.Status ?? "");
  const id = String(data.id ?? data.Id ?? sessionId);

  return { id, status, players };
}

