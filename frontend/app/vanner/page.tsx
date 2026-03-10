"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { getGameTypeFromId } from "@/lib/game-type";
import { cn } from "@/lib/utils";

type Friend = { id: string; displayName: string; email: string; friendsSince: string };
type ReceivedRequest = { id: string; fromUserDisplayName: string; createdAt: string };

function VannerPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteGameId = searchParams.get("inviteGame"); // från spelkort: vilket spel vi bjuder in till
  const inviteGameType = inviteGameId ? getGameTypeFromId(inviteGameId) : null;

  const [friends, setFriends] = useState<Friend[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<ReceivedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createGameFor, setCreateGameFor] = useState<Friend | null>(null);
  const [createGameType, setCreateGameType] = useState<2 | 3 | 4 | 5>(() =>
    inviteGameType ?? 2
  );
  const [creating, setCreating] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());

  const inviteGameLabel: Record<string, string> = {
    fivehoundred: "500",
    chicago: "Chicago",
    texasholdem: "Texas Hold'em",
    skitgubbe: "Skitgubbe",
  };
  const currentInviteGameLabel = inviteGameId ? inviteGameLabel[inviteGameId] ?? null : null;

  useEffect(() => {
    if (inviteGameType != null) setCreateGameType(inviteGameType);
  }, [inviteGameType]);

  const loadData = useCallback(async () => {
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        apiFetch("/api/friends"),
        apiFetch("/api/friends/requests/received"),
      ]);
      if (friendsRes.status === 401 || requestsRes.status === 401) {
        router.push("/");
        return;
      }
      const friendsData = await friendsRes.json().catch(() => []);
      const requestsData = await requestsRes.json().catch(() => []);
      setFriends(Array.isArray(friendsData) ? friendsData : []);
      setReceivedRequests(Array.isArray(requestsData) ? requestsData : []);
    } catch {
      setError("Kunde inte hämta data.");
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    loadData().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [loadData]);

  const respondToRequest = async (requestId: string, accept: boolean) => {
    const res = await apiFetch(
      `/api/friends/requests/${requestId}/${accept ? "accept" : "decline"}`,
      { method: "POST" }
    );
    if (res.ok) {
      await loadData();
      if (typeof window !== "undefined") window.dispatchEvent(new Event("friend-requests-changed"));
    } else {
      setError(accept ? "Kunde inte acceptera." : "Kunde inte avvisa.");
    }
  };

  const handleCreateGame = async () => {
    if (!createGameFor) return;
    setCreating(true);
    try {
      const maxPlayers = createGameType === 3 ? 2 : 6; // Chicago: 2, 500/Skitgubbe/Texas: 6
      const createRes = await apiFetch("/api/gamesessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType: createGameType, maxPlayers }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        setError(err.error ?? "Kunde inte skapa spel.");
        return;
      }
      const session = await createRes.json();
      const inviteRes = await apiFetch(`/api/gamesessions/${session.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: createGameFor.id }),
      });
      if (!inviteRes.ok) {
        const err = await inviteRes.json().catch(() => ({}));
        setError(err.error ?? "Spelet skapades men inbjudan misslyckades.");
        return;
      }
      setCreateGameFor(null);
      router.push("/spel");
    } catch {
      setError("Kunde inte skapa spel.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 p-4 sm:p-6">
        <p className="text-muted-foreground">Laddar vänner...</p>
      </main>
    );
  }

  return (
    <main className="flex-1 p-3 sm:p-6">
      <section className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-lg sm:text-xl font-semibold">Mina vänner</h1>
        {currentInviteGameLabel && (
          <p className="mb-3 text-muted-foreground text-sm">
            Du bjuder in till <span className="font-medium text-foreground">{currentInviteGameLabel}</span>. Välj vänner och klicka &quot;Bjud in alla till spel&quot;.
          </p>
        )}
        {error && (
          <p className="mb-4 text-destructive text-sm">{error}</p>
        )}

        {receivedRequests.length > 0 && (
          <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--warm-peach)]/30 p-4">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              Vänförfrågningar ({receivedRequests.length})
            </h2>
            <ul className="space-y-2">
              {receivedRequests.map((req) => (
                <li
                  key={req.id}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 rounded border bg-background p-3"
                >
                  <span className="truncate">{req.fromUserDisplayName} vill bli din vän</span>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => respondToRequest(req.id, true)}
                      className="min-h-10 flex-1 sm:flex-initial"
                    >
                      Acceptera
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => respondToRequest(req.id, false)}
                      className="min-h-10 flex-1 sm:flex-initial"
                    >
                      Avvisa
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {friends.length === 0 ? (
          <p className="text-muted-foreground">
            Du har inga vänner än. Använd &quot;Väninbjudan&quot; i menyn för att bjuda in någon via e-post.
          </p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={selectedFriendIds.size === 0}
                onClick={() => {
                  const ids = [...selectedFriendIds];
                  const gameType = inviteGameType ?? createGameType;
                  const q = new URLSearchParams({ invite: ids.join(","), gameType: String(gameType) });
                  router.push(`/spel?${q.toString()}`);
                }}
                className="min-h-10"
              >
                Bjud in alla till spel
              </Button>
              {selectedFriendIds.size > 0 && (
                <span className="text-muted-foreground text-sm">
                  {selectedFriendIds.size} valda
                </span>
              )}
            </div>
            <ul className="grid gap-2">
              {friends.map((f) => (
                <li
                  key={f.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-card p-3 shadow-sm",
                    selectedFriendIds.has(f.id) && "ring-2 ring-primary/30"
                  )}
                >
                  <label className="flex min-w-0 cursor-pointer flex-1 items-center gap-3">
                    <Checkbox
                      checked={selectedFriendIds.has(f.id)}
                      onCheckedChange={(checked) => {
                        setSelectedFriendIds((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(f.id);
                          else next.delete(f.id);
                          return next;
                        });
                      }}
                      className="size-5 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="font-medium">{f.displayName}</span>
                      <span className="text-muted-foreground text-sm block sm:inline truncate"> {f.email}</span>
                    </div>
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateGameFor(f)}
                    className="min-h-10 w-full sm:w-auto shrink-0"
                  >
                    Skapa spel
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <Dialog open={!!createGameFor} onOpenChange={(open) => !open && setCreateGameFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skapa spel med {createGameFor?.displayName}</DialogTitle>
            <DialogDescription>
              Välj spel och skicka inbjudan till {createGameFor?.displayName}. De får den i &quot;Mina spel&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={createGameType === 2 ? "default" : "outline"}
                size="sm"
                onClick={() => setCreateGameType(2)}
                className="min-h-10 flex-1 sm:flex-initial"
              >
                500
              </Button>
              <Button
                variant={createGameType === 3 ? "default" : "outline"}
                size="sm"
                onClick={() => setCreateGameType(3)}
                className="min-h-10 flex-1 sm:flex-initial"
              >
                Chicago
              </Button>
              <Button
                variant={createGameType === 4 ? "default" : "outline"}
                size="sm"
                onClick={() => setCreateGameType(4)}
                className="min-h-10 flex-1 sm:flex-initial"
              >
                Texas Hold&apos;em
              </Button>
              <Button
                variant={createGameType === 5 ? "default" : "outline"}
                size="sm"
                onClick={() => setCreateGameType(5)}
                className="min-h-10 flex-1 sm:flex-initial"
              >
                Skitgubbe
              </Button>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateGameFor(null)} className="min-h-10">
                Avbryt
              </Button>
              <Button onClick={handleCreateGame} disabled={creating} className="min-h-10">
                {creating
                  ? "Skapar..."
                  : "Skicka inbjudan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function VannerPage() {
  return (
    <Suspense fallback={
      <main className="flex-1 p-4 sm:p-6">
        <p className="text-muted-foreground">Laddar...</p>
      </main>
    }>
      <VannerPageContent />
    </Suspense>
  );
}
