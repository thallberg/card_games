"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

export default function VaninbjudanPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch("/api/friends/request-by-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Kunde inte skicka inbjudan.");
        return;
      }
      setEmail("");
      setSuccess(true);
      window.dispatchEvent(new Event("friend-requests-changed"));
    } catch {
      setError("Kunde inte ansluta till servern.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 p-3 sm:p-6">
      <section className="mx-auto max-w-md">
        <h1 className="mb-1 text-xl font-semibold">Bjud in vän</h1>
        <p className="mb-6 text-muted-foreground text-sm">
          Skicka en vänförfrågan till någons e-postadress. De måste ha ett konto.
        </p>

        {success ? (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="font-medium text-foreground">Inbjudan skickad</p>
            <p className="mt-1 text-muted-foreground text-sm">
              Vänförfrågan har skickats. Personen kan se den under Vänner.
            </p>
            <div className="mt-4 flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/vanner">Gå till Vänner</Link>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setSuccess(false);
                }}
              >
                Skicka en till
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="invite-email">E-postadress</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="vän@exempel.se"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? "Skickar..." : "Skicka inbjudan"}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
