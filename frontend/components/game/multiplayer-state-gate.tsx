import type { ReactNode } from "react";
import Link from "next/link";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";

type MultiplayerStateGateProps = {
  useMulti: boolean;
  loading: boolean;
  waitingForStart: boolean;
  hasState: boolean;
  onRetry?: () => void;
};

export function MultiplayerStateGate({
  useMulti,
  loading,
  waitingForStart,
  hasState,
  onRetry,
}: MultiplayerStateGateProps): ReactNode {
  if (!useMulti) return null;

  if (loading) {
    return (
      <div className="flex min-h-[200px] flex-1 items-center justify-center">
        <Spinner size="xl" className="text-primary" />
      </div>
    );
  }

  if (waitingForStart) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-1 sm:px-0">
        <p className="text-muted-foreground">Väntar på att ledaren startar spelet…</p>
        <p className="text-muted-foreground text-sm">
          Spelet startar när partiledaren klickar &quot;Starta spelet&quot; i Mina spel.
        </p>
        <Button asChild variant="outline">
          <Link href="/spel">Gå till Mina spel</Link>
        </Button>
      </div>
    );
  }

  if (!hasState) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-center">Kunde inte ladda spelet.</p>
        {onRetry ? (
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" onClick={onRetry}>
              Försök igen
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/spel">Mina spel</Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground text-sm text-center">
              Kontrollera att partiledaren har klickat &quot;Starta spelet&quot; i Mina spel.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/spel">Mina spel</Link>
            </Button>
          </>
        )}
      </div>
    );
  }

  return null;
}

