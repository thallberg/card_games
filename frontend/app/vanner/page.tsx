"use client";

import { useState, useEffect } from "react";
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

export default function VannerPage() {
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createGameFor, setCreateGameFor] = useState<Friend | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/friends");
        if (res.status === 401) {
          router.push("/");
          return;
        }
        const data = await res.json().catch(() => []);
        if (!cancelled) setFriends(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError("Kunde inte hämta vänner.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const handleCreateGame = async () => {
    if (!createGameFor) return;
    setCreating(true);
    try {
      const createRes = await apiFetch("/api/gamesessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType: 2, maxPlayers: 4 }),
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
    <main className="flex-1 p-4 sm:p-6">
      <section className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-xl font-semibold">Mina vänner</h1>
        {error && (
          <p className="mb-4 text-destructive text-sm">{error}</p>
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
                className="flex items-center justify-between rounded-lg border bg-card p-3"
              >
                <div>
                  <span className="font-medium">{f.displayName}</span>
                  <span className="text-muted-foreground text-sm"> {f.email}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateGameFor(f)}
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
              Skapa en spelomgång 500 och skicka en inbjudan till {createGameFor?.displayName}. De får den i &quot;Mina spel&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateGameFor(null)}>
              Avbryt
            </Button>
            <Button onClick={handleCreateGame} disabled={creating}>
              {creating ? "Skapar..." : "Skapa 500 och skicka inbjudan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
