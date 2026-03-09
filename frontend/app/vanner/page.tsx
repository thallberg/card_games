"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";

type Friend = { id: string; displayName: string; email: string; friendsSince: string };
type ReceivedRequest = { id: string; fromUserDisplayName: string; createdAt: string };

export default function VannerPage() {
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<ReceivedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createGameFor, setCreateGameFor] = useState<Friend | null>(null);
  const [createGameType, setCreateGameType] = useState<2 | 3 | 4>(2);
  const [creating, setCreating] = useState(false);

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
      const maxPlayers = createGameType === 3 ? 2 : createGameType === 4 ? 6 : 6; // 500: upp till 6, Chicago: 2, Texas: 6
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
          <ul className="grid gap-2">
            {friends.map((f) => (
              <li
                key={f.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-card p-3 shadow-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium">{f.displayName}</span>
                  <span className="text-muted-foreground text-sm block sm:inline truncate"> {f.email}</span>
                </div>
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
