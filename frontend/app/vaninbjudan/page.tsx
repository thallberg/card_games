"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiFetch } from "@/lib/api";

type UserSearchResult = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  avatarEmoji?: string | null;
  avatarImageData?: string | null;
};

export default function VaninbjudanPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError("Skriv minst 2 tecken för att söka.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`/api/users/search?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        const msg = (data as { error?: string }).error ?? "Kunde inte söka efter användare.";
        setError(msg);
        toast.error(msg);
        setResults([]);
        return;
      }
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setError("Kunde inte ansluta till servern.");
      toast.error("Kunde inte ansluta till servern.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (userId: string, displayName: string) => {
    setError(null);
    setSuccessMessage(null);
    setInvitingId(userId);
    try {
      const res = await apiFetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (data as { error?: string }).error ?? "Kunde inte skicka vänförfrågan.";
        setError(msg);
        toast.error(msg);
        return;
      }
      setSuccessMessage(`Vänförfrågan skickad till ${displayName}.`);
      toast.success(`Vänförfrågan skickad till ${displayName}`);
      window.dispatchEvent(new Event("friend-requests-changed"));
    } catch {
      setError("Kunde inte ansluta till servern.");
      toast.error("Kunde inte ansluta till servern.");
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <main className="flex-1 p-3 sm:p-6">
      <section className="mx-auto max-w-md">
        <h1 className="mb-6 text-xl font-semibold">Bjud in vän</h1>

        <form onSubmit={handleSearch} className="grid gap-4 mb-4">
          <div className="grid gap-2">
            <Label htmlFor="invite-name">Sök efter användare</Label>
            <div className="flex min-w-0 items-center border-b-2 border-muted-foreground/60 focus-within:border-b-primary focus-within:border-b-2">
              <span className="flex h-9 shrink-0 items-center pl-3 text-muted-foreground" aria-hidden>
                {loading ? <Spinner size="sm" /> : <Search className="h-4 w-4" />}
              </span>
              <Input
                id="invite-name"
                type="text"
                placeholder="T.ex. Tobbe"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-w-0 flex-1 border-0 rounded-none shadow-none focus-visible:ring-0 focus-visible:border-0 pl-1 pr-3"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-auto px-3 text-sm font-normal border-primary text-primary hover:bg-primary/5 hover:text-primary"
            >
              <Link href="/vanner">Gå till Vänner</Link>
            </Button>
          </div>
        </form>

        {error && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
            <Button variant="outline" size="sm" onClick={() => { setError(null); }}>
              Stäng
            </Button>
          </div>
        )}
        {successMessage && (
          <p className="mb-3 text-sm text-green-600 dark:text-green-400">{successMessage}</p>
        )}

        <div className="space-y-2">
          {results.length === 0 && !error && !loading && query.trim().length >= 2 && (
            <p className="text-muted-foreground text-sm">Inga användare hittades.</p>
          )}
          {results.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-8 w-8 shrink-0 rounded-full bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]">
                  {u.avatarImageData && (
                    <AvatarImage src={u.avatarImageData} alt={u.displayName} />
                  )}
                  <AvatarFallback aria-hidden>
                    {u.avatarEmoji ?? u.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium truncate">{u.displayName}</p>
                  <p className="text-muted-foreground text-xs truncate">{u.email}</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleInvite(u.id, u.displayName)}
                disabled={invitingId === u.id}
              >
                {invitingId === u.id ? <Spinner size="sm" /> : "Bli vän"}
              </Button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
