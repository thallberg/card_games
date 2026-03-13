"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        setError((data as { error?: string }).error ?? "Kunde inte söka efter användare.");
        setResults([]);
        return;
      }
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setError("Kunde inte ansluta till servern.");
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
        setError((data as { error?: string }).error ?? "Kunde inte skicka vänförfrågan.");
        return;
      }
      setSuccessMessage(`Vänförfrågan skickad till ${displayName}.`);
      window.dispatchEvent(new Event("friend-requests-changed"));
    } catch {
      setError("Kunde inte ansluta till servern.");
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <main className="flex-1 p-3 sm:p-6">
      <section className="mx-auto max-w-md">
        <h1 className="mb-1 text-xl font-semibold">Bjud in vän</h1>
        <p className="mb-6 text-muted-foreground text-sm">
          Sök på användarnamn och skicka en vänförfrågan.
        </p>

        <form onSubmit={handleSearch} className="grid gap-4 mb-4">
          <div className="grid gap-2">
            <Label htmlFor="invite-name">Användarnamn</Label>
            <Input
              id="invite-name"
              type="text"
              placeholder="T.ex. Tobbe"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={loading}
              className="h-auto px-3 text-sm font-normal border-primary text-primary hover:bg-primary/5 hover:text-primary"
            >
              <Search className="mr-1 h-3.5 w-3.5" />
              {loading ? "Söker..." : "Sök användare"}
            </Button>
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
          <p className="mb-3 text-destructive text-sm" role="alert">
            {error}
          </p>
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
                {invitingId === u.id ? "Skickar..." : "Bjud in"}
              </Button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
