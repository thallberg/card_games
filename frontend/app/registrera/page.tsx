"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FALLBACK_API_URL = "http://localhost:5236";

async function getApiUrl(): Promise<string> {
  try {
    const res = await fetch("/api/config", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    const url = (data.apiUrl ?? FALLBACK_API_URL).trim().replace(/\/$/, "");
    return url || FALLBACK_API_URL;
  } catch {
    return FALLBACK_API_URL;
  }
}

export default function RegistreraPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    setIsLoggedIn(!!token);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const apiUrl = await getApiUrl();
      const res = await fetch(`${apiUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Registrering misslyckades.");
        return;
      }
      const loginRes = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const loginData = await loginRes.json().catch(() => ({}));
      if (!loginRes.ok) {
        setError((loginData as { error?: string }).error ?? "Inloggning misslyckades.");
        return;
      }
      if (loginData.token && typeof window !== "undefined") {
        localStorage.setItem("token", loginData.token);
        if (loginData.user) localStorage.setItem("user", JSON.stringify(loginData.user));
        window.dispatchEvent(new Event("user-updated"));
        setSuccess(true);
        setTimeout(() => router.push("/"), 1500);
      }
    } catch {
      setError("Kunde inte ansluta till servern.");
    } finally {
      setLoading(false);
    }
  };

  if (isLoggedIn === null) {
    return (
      <main className="flex-1 p-3 sm:p-6 flex items-center justify-center min-h-[200px]">
        <Spinner size="xl" className="text-primary" />
      </main>
    );
  }

  if (isLoggedIn) {
    return (
      <main className="flex-1 p-3 sm:p-6">
        <section className="mx-auto max-w-md space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center text-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="size-6 text-primary" aria-hidden />
            </div>
            <h2 className="text-lg font-semibold">Konto aktivt</h2>
            <p className="text-muted-foreground text-sm">
              Du är redan registrerad och inloggad. Gå till Min profil för att hantera ditt konto.
            </p>
            <Link href="/min-meny">
              <Button variant="outline" size="sm">Min profil</Button>
            </Link>
          </div>
          <Link href="/" className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
            ← Tillbaka till startsidan
          </Link>
        </section>
      </main>
    );
  }

  if (success) {
    return (
      <main className="flex-1 p-3 sm:p-6">
        <section className="mx-auto max-w-md space-y-4 text-center">
          <p className="text-muted-foreground">Kontot är skapat. Du omdirigeras...</p>
          <Spinner size="lg" className="text-primary mx-auto" />
        </section>
      </main>
    );
  }

  return (
    <main className="flex-1 p-3 sm:p-6">
      <section className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Registrera</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Fyll i uppgifterna nedan för att skapa ett konto.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="displayName">Visningsnamn</Label>
            <Input
              id="displayName"
              placeholder="t.ex. Anna"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">E-post</Label>
            <Input
              id="email"
              type="email"
              placeholder="din@epost.se"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Lösenord</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={6}
            />
            <p className="text-muted-foreground text-xs">Minst 6 tecken.</p>
          </div>

          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" variant="outlinePrimary" disabled={loading} className="w-full sm:w-auto">
            {loading ? <Spinner size="sm" /> : "Skapa konto"}
          </Button>
        </form>

        <p className="text-muted-foreground text-sm">
          Har du redan konto?{" "}
          <Link href="/logga-in" className="underline underline-offset-2 hover:text-foreground">
            Logga in
          </Link>
        </p>
        <Link href="/" className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
          ← Tillbaka till startsidan
        </Link>
      </section>
    </main>
  );
}
