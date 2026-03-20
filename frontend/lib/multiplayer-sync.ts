/**
 * Shared helpers for multiplayer React hooks.
 *
 * Problem: multiplayer hooks duplicate the same pattern:
 * - call a send* API function
 * - if it returns a result, sync local `state` and `myPlayerId` (and maybe extra fields)
 */

export async function sendAndSync<TState, TMyPlayerId>(
  sessionId: string | undefined,
  send: () => Promise<{ state: TState; myPlayerId: TMyPlayerId } | null>,
  onSuccess: (result: { state: TState; myPlayerId: TMyPlayerId }) => void
): Promise<void> {
  if (!sessionId) return;
  const result = await send();
  if (!result) return;
  onSuccess(result);
}

export async function sendAndSyncStateOnly<TState>(
  sessionId: string | undefined,
  send: () => Promise<{ state: TState; lastDrawnCard?: unknown | null } | null>,
  onSuccess: (result: { state: TState; lastDrawnCard?: unknown | null }) => void
): Promise<void> {
  if (!sessionId) return;
  const result = await send();
  if (!result) return;
  onSuccess(result);
}

