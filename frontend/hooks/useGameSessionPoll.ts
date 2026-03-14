"use client";

import { useEffect, useRef } from "react";

export type UseGameSessionPollOptions = {
  /** Game session id. When undefined, no polling runs. */
  sessionId: string | undefined;
  /** Callback to fetch latest state (e.g. from API). */
  loadState: () => Promise<void>;
  /** When true, poll at waitForStartPollMs until game has started. */
  isWaitingForStart?: boolean;
  /** Interval (ms) when waiting for game start. */
  waitForStartPollMs?: number;
  /** When true, do not run main poll (e.g. it's my turn or game in transitional state). */
  shouldPausePolling: boolean;
  /** When true and gameOverPollMs is set, poll at gameOverPollMs to refresh (e.g. see final state). */
  isGameOver?: boolean;
  /** Interval (ms) when waiting for other player's move. */
  pollIntervalMs?: number;
  /** Interval (ms) when game is over (if isGameOver and this is set). */
  gameOverPollMs?: number;
};

const DEFAULT_POLL_MS = 1500;
const DEFAULT_WAIT_FOR_START_MS = 2000;

/**
 * Shared polling for multiplayer game sessions: initial load, waiting-for-start poll,
 * and main turn-based poll. Clear interval when it's the current player's turn.
 */
export function useGameSessionPoll({
  sessionId,
  loadState,
  isWaitingForStart = false,
  waitForStartPollMs = DEFAULT_WAIT_FOR_START_MS,
  shouldPausePolling,
  isGameOver = false,
  pollIntervalMs = DEFAULT_POLL_MS,
  gameOverPollMs,
}: UseGameSessionPollOptions) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial load when sessionId is set
  useEffect(() => {
    if (!sessionId) return;
    loadState();
  }, [sessionId, loadState]);

  // Poll while waiting for game start
  useEffect(() => {
    if (!sessionId || !isWaitingForStart) return;
    const interval = setInterval(loadState, waitForStartPollMs);
    return () => clearInterval(interval);
  }, [sessionId, isWaitingForStart, waitForStartPollMs, loadState]);

  // Main poll: when not my turn (or game over with optional slow poll)
  useEffect(() => {
    if (!sessionId) return;

    if (shouldPausePolling && !isGameOver) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    if (isGameOver && gameOverPollMs != null) {
      loadState();
      pollRef.current = setInterval(loadState, gameOverPollMs);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }

    if (shouldPausePolling) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }

    loadState();
    pollRef.current = setInterval(loadState, pollIntervalMs);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [
    sessionId,
    shouldPausePolling,
    isGameOver,
    gameOverPollMs,
    pollIntervalMs,
    loadState,
  ]);
}
