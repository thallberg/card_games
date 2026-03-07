"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

type Player = { userId: string; displayName: string; seatOrder: number; joinedAt: string };
type Session = {
  id: string;
  leaderId: string;
  leaderDisplayName: string;
  gameType: string;
  status: string;
  maxPlayers: number;
  currentPlayerCount: number;
  createdAt: string;
  players: Player[];
};

export default function SpelPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [texasSetup, setTexasSetup] = useState<{
    sessionId: string;
    buyIn: number;
    bigBlind: number;
  } | null>(null);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    if (raw) {
      try {
        const u = JSON.parse(raw) as { id?: string };
        setCurrentUserId(u?.id ?? null);
      } catch {
        setCurrentUserId(null);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/gamesessions");
        if (res.status === 401) {
          router.push("/");
          return;
        }
        const data = await res.json().catch(() => []);
        if (!cancelled) setSessions(Array.isArray(data) ? data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const handleStart = async (sessionId: string, body?: { buyIn?: number; bigBlind?: number }) => {
    setStarting(sessionId);
    try {
      const res = await apiFetch(`/api/gamesessions/${sessionId}/start`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) {
        const session = sessions.find((s) => s.id === sessionId);
        const gamePath =
          session?.gameType === "Chicago"
            ? "/games/chicago"
            : session?.gameType === "TexasHoldem"
              ? "/games/texasholdem"
              : "/games/fivehoundred";
        router.push(`${gamePath}?sessionId=${sessionId}`);
        setTexasSetup(null);
        return;
      }
    } finally {
      setStarting(null);
    }
  };

  const handleLeave = async (sessionId: string) => {
    setLeaving(sessionId);
    try {
      const res = await apiFetch(`/api/gamesessions/${sessionId}/leave`, {
        method: "POST",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      }
    } finally {
      setLeaving(null);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 p-4 sm:p-6">
        <p className="text-muted-foreground">Laddar spel...</p>
      </main>
    );
  }

  const waiting = sessions.filter((s) => s.status === "Waiting");
  const inProgress = sessions.filter((s) => s.status === "InProgress");

  return (
    <main className="flex-1 p-3 sm:p-6">
      <section className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-lg sm:text-xl font-semibold">Mina spel</h1>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground">
            Du har inga spel än. Gå till <Link href="/vanner" className="underline">Vänner</Link> och skapa ett spel med en vän.
          </p>
        ) : (
          <div className="space-y-6">
            {waiting.length > 0 && (
              <div>
                <h2 className="mb-2 font-medium text-muted-foreground">Väntar på start</h2>
                <ul className="grid gap-2">
                  {waiting.map((s) => {
                    const isLeader = currentUserId != null && s.leaderId === currentUserId;
                    return (
                      <li
                        key={s.id}
                        className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-card p-3 shadow-sm"
                      >
                        <div className="min-w-0">
                          <span className="font-medium">
                            {s.gameType === "FiveHundred" ? "500" : s.gameType === "Chicago" ? "Chicago" : s.gameType === "TexasHoldem" ? "Texas Hold'em" : s.gameType}
                          </span>
                          <span className="text-muted-foreground text-sm block sm:inline">
                            {" "}– ledd av {s.leaderDisplayName} · {s.currentPlayerCount}/{s.maxPlayers} spelare
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {isLeader && (
                            s.currentPlayerCount >= 2 ? (
                              s.gameType === "TexasHoldem" ? (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    setTexasSetup({
                                      sessionId: s.id,
                                      buyIn: 2000,
                                      bigBlind: 20,
                                    })
                                  }
                                  disabled={starting === s.id}
                                >
                                  Starta spelet
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleStart(s.id)}
                                  disabled={starting === s.id}
                                >
                                  {starting === s.id ? "Startar..." : "Starta spelet"}
                                </Button>
                              )
                            ) : (
                              <span className="text-muted-foreground text-sm">Väntar på spelare</span>
                            )
                          )}
                          {!isLeader && (
                            <span className="text-muted-foreground text-sm">Väntar på att {s.leaderDisplayName} startar</span>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLeave(s.id)}
                            disabled={leaving === s.id}
                          >
                            {leaving === s.id ? "Avslutar..." : "Avsluta"}
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {inProgress.length > 0 && (
              <div>
                <h2 className="mb-2 font-medium text-muted-foreground">Pågående</h2>
                <ul className="grid gap-2">
                  {inProgress.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-card p-3 shadow-sm"
                    >
                      <span className="min-w-0 truncate">
                        {s.gameType === "FiveHundred" ? "500" : s.gameType === "Chicago" ? "Chicago" : s.gameType === "TexasHoldem" ? "Texas Hold'em" : s.gameType} – {s.leaderDisplayName}
                      </span>
                      <div className="flex gap-2 shrink-0 flex-wrap">
                        <Button asChild size="sm">
                          <Link
                            href={
                              s.gameType === "Chicago"
                                ? `/games/chicago?sessionId=${s.id}`
                                : s.gameType === "TexasHoldem"
                                  ? `/games/texasholdem?sessionId=${s.id}`
                                  : `/games/fivehoundred?sessionId=${s.id}`
                            }
                          >
                            Fortsätt spela
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleLeave(s.id)}
                          disabled={leaving === s.id}
                        >
                          {leaving === s.id ? "Avslutar..." : "Avsluta"}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <Dialog open={!!texasSetup} onOpenChange={(open) => !open && setTexasSetup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Texas Hold&apos;em – Inställningar</DialogTitle>
          </DialogHeader>
          {texasSetup && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleStart(texasSetup.sessionId, {
                  buyIn: texasSetup.buyIn,
                  bigBlind: texasSetup.bigBlind,
                });
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="buyin">Buy-in per spelare</Label>
                <Input
                  id="buyin"
                  type="number"
                  min={1}
                  value={texasSetup.buyIn}
                  onChange={(e) =>
                    setTexasSetup((p) =>
                      p ? { ...p, buyIn: Number(e.target.value) || 2000 } : p
                    )
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="bigblind">Big blind</Label>
                <Input
                  id="bigblind"
                  type="number"
                  min={1}
                  value={texasSetup.bigBlind}
                  onChange={(e) =>
                    setTexasSetup((p) =>
                      p ? { ...p, bigBlind: Number(e.target.value) || 20 } : p
                    )
                  }
                  className="mt-1"
                />
                <p className="text-muted-foreground text-sm mt-1">
                  Small blind blir automatiskt hälften: {Math.floor(texasSetup.bigBlind / 2)}
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTexasSetup(null)}
                >
                  Avbryt
                </Button>
                <Button type="submit" disabled={starting === texasSetup.sessionId}>
                  {starting === texasSetup.sessionId ? "Startar..." : "Starta spelet"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
