"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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

  const handleStart = async (sessionId: string) => {
    setStarting(sessionId);
    try {
      const res = await apiFetch(`/api/gamesessions/${sessionId}/start`, {
        method: "POST",
      });
      if (res.ok) {
        const session = sessions.find((s) => s.id === sessionId);
        const gamePath = session?.gameType === "Chicago" ? "/games/chicago" : "/games/fivehoundred";
        router.push(`${gamePath}?sessionId=${sessionId}`);
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
    <main className="flex-1 p-4 sm:p-6">
      <section className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-xl font-semibold">Mina spel</h1>
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
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3"
                      >
                        <div>
                          <span className="font-medium">
                            {s.gameType === "FiveHundred" ? "500" : s.gameType === "Chicago" ? "Chicago" : s.gameType}
                          </span>
                          <span className="text-muted-foreground text-sm">
                            {" "}– ledd av {s.leaderDisplayName} · {s.currentPlayerCount}/{s.maxPlayers} spelare
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {isLeader && (
                            s.currentPlayerCount >= 2 ? (
                              <Button
                                size="sm"
                                onClick={() => handleStart(s.id)}
                                disabled={starting === s.id}
                              >
                                {starting === s.id ? "Startar..." : "Starta spelet"}
                              </Button>
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
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3"
                    >
                      <span>
                        {s.gameType === "FiveHundred" ? "500" : s.gameType === "Chicago" ? "Chicago" : s.gameType === "Chicago" ? "Chicago" : s.gameType} – {s.leaderDisplayName}
                      </span>
                      <div className="flex gap-2">
                        <Button asChild size="sm">
                          <Link href={s.gameType === "Chicago" ? `/games/chicago?sessionId=${s.id}` : `/games/fivehoundred?sessionId=${s.id}`}>
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
    </main>
  );
}
