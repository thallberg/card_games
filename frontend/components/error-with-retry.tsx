"use client";

import { Button } from "@/components/ui/button";

type ErrorWithRetryProps = {
  message: string;
  onRetry: () => void;
  /** Optional secondary action (e.g. link to Mina spel) */
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export function ErrorWithRetry({
  message,
  onRetry,
  secondaryLabel,
  onSecondary,
}: ErrorWithRetryProps) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-destructive/50 bg-destructive/10 p-6">
      <p className="text-destructive text-center">{message}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" onClick={onRetry} size="sm">
          Försök igen
        </Button>
        {secondaryLabel && onSecondary && (
          <Button variant="outline" onClick={onSecondary} size="sm">
            {secondaryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
