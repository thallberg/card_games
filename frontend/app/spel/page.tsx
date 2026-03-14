"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingPage } from "@/components/ui/loading-page";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api";

type Friend = { id: string; displayName: string; email: string; friendsSince: string };
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

const DEFAULT_INVITE_GAME_TYPE = 2; // 500 om gameType saknas i URL

function SpelPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [texasSetup, setTexasSetup] = useState<{
    sessionId: string;
    buyIn: number;
    bigBlind: number;
    buyInStr: string;
    bigBlindStr: string;
  } | null>(null);
  const [inviteMoreFor, setInviteMoreFor] = useState<Session | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [inviting, setInviting] = useState<string | null>(null);
  const [creatingFromInvite, setCreatingFromInvite] = useState(false);

  const loadFriends = useCallback(async () => {
    const res = await apiFetch("/api/friends");
    if (!res.ok) return;
    const data = await res.json().catch(() => []);
    setFriends(Array.isArray(data) ? data : []);
  }, []);

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

  const loadSessions = useCallback(async () => {
    const res = await apiFetch("/api/gamesessions");
    if (res.status === 401) {
      router.push("/");
      return;
    }
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? data : [];
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    loadSessions().then((data) => {
      if (!cancelled && data) setSessions(data);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [loadSessions]);

  // När användaren kommer från vänner med ?invite=id1,id2&gameType=2: skapa session för rätt spel, bjud in alla
  useEffect(() => {
    const inviteParam = searchParams.get("invite");
    if (!inviteParam) return;
    const ids = inviteParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return;
    const gameTypeParam = searchParams.get("gameType");
    const gameType = gameTypeParam ? parseInt(gameTypeParam, 10) : DEFAULT_INVITE_GAME_TYPE;
    const validGameType = [2, 3, 4, 5].includes(gameType) ? gameType : DEFAULT_INVITE_GAME_TYPE;

    let cancelled = false;
    setCreatingFromInvite(true);
    (async () => {
      try {
        const maxPlayers = validGameType === 3 ? 2 : 6; // Chicago: 2, övriga: 6
        const createRes = await apiFetch("/api/gamesessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameType: validGameType, maxPlayers }),
        });
        if (!createRes.ok || cancelled) return;
        const session = await createRes.json();
        for (const friendId of ids) {
          if (cancelled) return;
          await apiFetch(`/api/gamesessions/${session.id}/invite`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: friendId }),
          });
        }
        if (cancelled) return;
        const updated = await loadSessions();
        if (updated) setSessions(updated);
        router.replace("/spel", { scroll: false });
      } finally {
        if (!cancelled) setCreatingFromInvite(false);
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams, loadSessions, router]);

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
              : session?.gameType === "Skitgubbe"
                ? "/games/skitgubbe"
                : "/games/fivehoundred";
        router.push(`${gamePath}?sessionId=${sessionId}`);
        setTexasSetup(null);
        return;
      }
    } finally {
      setStarting(null);
    }
  };

  useEffect(() => {
    if (inviteMoreFor) loadFriends();
  }, [inviteMoreFor, loadFriends]);

  const handleInviteToSession = async (sessionId: string, friendId: string) => {
    setInviting(friendId);
    try {
      const res = await apiFetch(`/api/gamesessions/${sessionId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: friendId }),
      });
      if (res.ok) {
        const listRes = await apiFetch("/api/gamesessions");
        const data = await listRes.json().catch(() => []);
        const updatedList = Array.isArray(data) ? data : [];
        setSessions(updatedList);
        setInviteMoreFor((prev) => {
          if (!prev || prev.id !== sessionId) return prev;
          return updatedList.find((s: Session) => s.id === sessionId) ?? prev;
        });
      }
    } finally {
      setInviting(null);
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

  if (loading || creatingFromInvite) {
    return (
      <main className="flex-1">
        <LoadingPage />
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
                            {s.gameType === "FiveHundred" ? "500" : s.gameType === "Chicago" ? "Chicago" : s.gameType === "TexasHoldem" ? "Texas Hold'em" : s.gameType === "Skitgubbe" ? "Skitgubbe" : s.gameType}
                          </span>
                          <span className="text-muted-foreground text-sm block sm:inline">
                            {" "}– ledd av {s.leaderDisplayName} · {s.currentPlayerCount}/{s.maxPlayers} spelare
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {isLeader && (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setInviteMoreFor(s)}
                              >
                                Bjud in flera
                              </Button>
                              {s.currentPlayerCount >= 2 ? (
                                s.gameType === "TexasHoldem" ? (
                                  <Button
                                    size="sm"
                                    variant="outlinePrimary"
                                    onClick={() =>
                                      setTexasSetup({
                                        sessionId: s.id,
                                        buyIn: 2000,
                                        bigBlind: 20,
                                        buyInStr: "2000",
                                        bigBlindStr: "20",
                                      })
                                    }
                                    disabled={starting === s.id}
                                  >
                                    Starta spelet
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outlinePrimary"
                                    onClick={() => handleStart(s.id)}
                                    disabled={starting === s.id}
                                  >
                                    {starting === s.id ? <Spinner size="sm" /> : "Starta spelet"}
                                  </Button>
                                )
                              ) : (
                                <span className="text-muted-foreground text-sm">Väntar på spelare</span>
                              )}
                            </>
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
                            {leaving === s.id ? <Spinner size="sm" /> : "Avsluta"}
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
                        {s.gameType === "FiveHundred" ? "500" : s.gameType === "Chicago" ? "Chicago" : s.gameType === "TexasHoldem" ? "Texas Hold'em" : s.gameType === "Skitgubbe" ? "Skitgubbe" : s.gameType} – {s.leaderDisplayName}
                      </span>
                      <div className="flex gap-2 shrink-0 flex-wrap">
                        <Button asChild size="sm">
                          <Link
                            href={
                              s.gameType === "Chicago"
                                ? `/games/chicago?sessionId=${s.id}`
                                : s.gameType === "TexasHoldem"
                                  ? `/games/texasholdem?sessionId=${s.id}`
                                  : s.gameType === "Skitgubbe"
                                    ? `/games/skitgubbe?sessionId=${s.id}`
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
                          {leaving === s.id ? <Spinner size="sm" /> : "Avsluta"}
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

      <Dialog open={!!inviteMoreFor} onOpenChange={(open) => !open && setInviteMoreFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bjud in fler vänner</DialogTitle>
            <DialogDescription>
              {inviteMoreFor && (
                <>Välj vänner att bjuda in till {inviteMoreFor.gameType === "FiveHundred" ? "500" : inviteMoreFor.gameType === "Chicago" ? "Chicago" : inviteMoreFor.gameType === "TexasHoldem" ? "Texas Hold'em" : inviteMoreFor.gameType === "Skitgubbe" ? "Skitgubbe" : inviteMoreFor.gameType}.</>
              )}
            </DialogDescription>
          </DialogHeader>
          {inviteMoreFor && (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {friends
                .filter((f) => !inviteMoreFor.players.some((p) => p.userId === f.id))
                .map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-2 rounded border border-[var(--border)] p-2"
                  >
                    <span className="font-medium truncate">{f.displayName}</span>
                    <Button
                      size="sm"
                      variant="outlinePrimary"
                      onClick={() => handleInviteToSession(inviteMoreFor.id, f.id)}
                      disabled={inviting === f.id}
                    >
                      {inviting === f.id ? <Spinner size="sm" /> : "Bjud in till spel"}
                    </Button>
                  </div>
                ))}
              {friends.filter((f) => !inviteMoreFor.players.some((p) => p.userId === f.id)).length === 0 && (
                <p className="text-muted-foreground text-sm">
                  Alla dina vänner är redan inbjudna till detta spel.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteMoreFor(null)}>
              Stäng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  buyIn: Number(texasSetup.buyInStr) || 2000,
                  bigBlind: Number(texasSetup.bigBlindStr) || 20,
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
                  value={texasSetup.buyInStr}
                  onChange={(e) =>
                    setTexasSetup((p) =>
                      p ? { ...p, buyInStr: e.target.value } : p
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
                  value={texasSetup.bigBlindStr}
                  onChange={(e) =>
                    setTexasSetup((p) =>
                      p ? { ...p, bigBlindStr: e.target.value } : p
                    )
                  }
                  className="mt-1"
                />
                <p className="text-muted-foreground text-sm mt-1">
                  Small blind blir automatiskt hälften: {Math.floor((Number(texasSetup.bigBlindStr) || 20) / 2)}
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
                <Button type="submit" variant="outlinePrimary" disabled={starting === texasSetup.sessionId}>
                  {starting === texasSetup.sessionId ? <Spinner size="sm" /> : "Starta spelet"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function SpelPage() {
  return (
    <Suspense fallback={
      <main className="flex-1">
        <LoadingPage />
      </main>
    }>
      <SpelPageContent />
    </Suspense>
  );
}
