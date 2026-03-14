"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingPage } from "@/components/ui/loading-page";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api";
import { SectionCard } from "@/components/section-card";
import { Users, UserPlus } from "lucide-react";
import { getGameTypeFromId } from "@/lib/game-type";
import { cn } from "@/lib/utils";

type Friend = {
  id: string;
  displayName: string;
  email: string;
  friendsSince: string;
  avatarEmoji?: string | null;
  avatarImageData?: string | null;
};
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
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
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
      toast.error("Kunde inte hämta data.");
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
      toast.success(accept ? "Vänförfrågan accepterad" : "Vänförfrågan avvisad");
    } else {
      const msg = accept ? "Kunde inte acceptera." : "Kunde inte avvisa.";
      setError(msg);
      toast.error(msg);
    }
  };

  const handleInviteToGame = async () => {
    const idsToInvite =
      selectedFriendIds.size > 0 ? [...selectedFriendIds] : friends.map((f) => f.id);
    if (idsToInvite.length === 0) return;
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
        const msg = err.error ?? "Kunde inte skapa spel.";
        setError(msg);
        toast.error(msg);
        return;
      }
      const session = await createRes.json();
      for (const userId of idsToInvite) {
        const inviteRes = await apiFetch(`/api/gamesessions/${session.id}/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        if (!inviteRes.ok) {
          const err = await inviteRes.json().catch(() => ({}));
          const msg = err.error ?? "Spelet skapades men några inbjudan misslyckades.";
          setError(msg);
          toast.warning(msg);
          break;
        }
      }
      setInviteDialogOpen(false);
      toast.success("Spel skapat och inbjudningar skickade");
      router.push("/spel");
    } catch {
      setError("Kunde inte skapa spel.");
      toast.error("Kunde inte skapa spel.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1">
        <LoadingPage />
      </main>
    );
  }

  return (
    <main className="flex-1 p-3 sm:p-6">
      <section className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Mina vänner</h1>
          <p className="mt-2 text-muted-foreground text-sm sm:text-base">
            Hantera vänförfrågningar och bjud in till spel.
          </p>
        </header>
        {currentInviteGameLabel && (
          <p className="mb-3 text-muted-foreground text-sm">
            Du bjuder in till <span className="font-medium text-foreground">{currentInviteGameLabel}</span>. Välj vänner med kryssrutan eller bjud in alla – klicka sedan på knappen och välj spel i popupen.
          </p>
        )}
        {error && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <p className="text-destructive text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={() => { setError(null); loadData(); }}>
              Försök igen
            </Button>
          </div>
        )}

        {receivedRequests.length > 0 && (
          <SectionCard variant="peach" icon={UserPlus} title={`Vänförfrågningar (${receivedRequests.length})`}>
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
          </SectionCard>
        )}

        {friends.length === 0 ? (
          <p className="text-muted-foreground">
            Du har inga vänner än.{" "}
            <Link
              href="/vaninbjudan"
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Bjud in en vän
            </Link>{" "}
            för att komma igång.
          </p>
        ) : (
          <SectionCard variant="mint" icon={Users} title="Dina vänner">
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
                    <Avatar className="h-8 w-8 shrink-0 rounded-full bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]">
                      {f.avatarImageData && (
                        <AvatarImage src={f.avatarImageData} alt={f.displayName} />
                      )}
                      <AvatarFallback aria-hidden>
                        {f.avatarEmoji ?? f.displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <span className="font-medium">{f.displayName}</span>
                      <span className="text-muted-foreground text-sm block sm:inline truncate"> {f.email}</span>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInviteDialogOpen(true)}
                className="h-auto px-3 text-sm font-normal border-primary text-primary hover:bg-primary/5 hover:text-primary"
              >
                {selectedFriendIds.size > 0 ? "Bjud in valda till spel" : "Bjud in alla till spel"}
              </Button>
              {selectedFriendIds.size > 0 && (
                <span className="text-muted-foreground text-sm">
                  {selectedFriendIds.size} valda
                </span>
              )}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Vill du lägga till nya vänner?{" "}
              <Link
                href="/vaninbjudan"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                Bjud in en vän
              </Link>
              .
            </p>
          </SectionCard>
        )}
      </section>

      <Dialog open={inviteDialogOpen} onOpenChange={(open) => !open && setInviteDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bjud in till spel</DialogTitle>
            <DialogDescription>
              {selectedFriendIds.size > 0
                ? `Välj spel. ${selectedFriendIds.size} valda vänner bjuds in. De får inbjudan i &quot;Mina spel&quot;.`
                : "Välj spel. Alla dina vänner bjuds in. De får inbjudan i &quot;Mina spel&quot;."}
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
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)} className="min-h-10">
                Avbryt
              </Button>
              <Button variant="outlinePrimary" onClick={handleInviteToGame} disabled={creating} className="min-h-10">
                {creating ? <Spinner size="sm" /> : "Skicka inbjudan"}
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
      <main className="flex-1">
        <LoadingPage />
      </main>
    }>
      <VannerPageContent />
    </Suspense>
  );
}
