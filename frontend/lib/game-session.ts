/**
 * Helpers for game session UI flows.
 *
 * Current reuse case: multiplayer hooks need to determine whether to show
 * "waiting for start" based on:
 * - session.status === "Waiting"
 * - the current user exists in session.players
 */

export function getCurrentUserIdFromLocalStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: unknown };
    const id = parsed?.id;
    if (id == null) return null;
    return String(id);
  } catch {
    return null;
  }
}

type SessionLike = {
  status?: unknown;
  players?: unknown;
} | null | undefined;

function normalizeId(id: unknown): string {
  return String(id ?? "").toLowerCase();
}

export function isWaitingForStartForUser(session: SessionLike, userId: string | null): boolean {
  if (!session) return false;
  const status = normalizeId((session as { status?: unknown }).status);
  if (status !== "waiting") return false;
  if (!userId) return false;

  const players = (session as { players?: unknown }).players;
  if (!Array.isArray(players)) return false;

  const userIdNorm = normalizeId(userId);
  return players.some((p) => {
    if (p == null) return false;
    const pid = (p as { userId?: unknown; UserId?: unknown }).userId ?? (p as { UserId?: unknown }).UserId;
    return normalizeId(pid) === userIdNorm;
  });
}

