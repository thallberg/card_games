"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

function getConnectionErrorMessage(apiUrl: string): string {
  if (typeof window === "undefined") return "Kunde inte ansluta till servern.";
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (isLocal) {
    return "Kunde inte ansluta till servern. Starta backend med ’dotnet run’ i mappen backend (krävs för registrering och inloggning).";
  }
  const isLocalhostUrl = /^https?:\/\/localhost(\b|:)/i.test(apiUrl) || /^https?:\/\/127\.0\.0\.1\b/i.test(apiUrl);
  if (isLocalhostUrl) {
    return "Servern returnerade ingen API-URL. I Vercel: Settings → Environment Variables → lägg till API_URL med din Azure-URL och kryssa i Production (inte bara Preview).";
  }
  return `Kunde inte ansluta till ${apiUrl}. Kontrollera att backend körs på Azure och att CORS tillåter denna webbplats.`;
}

export type AuthModalMode = "login" | "register";

export type AuthModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AuthModalMode;
  onSuccess?: () => void;
};

export function AuthModal({
  open,
  onOpenChange,
  mode,
  onSuccess,
}: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const apiUrl = await getApiUrl();
      if (isRegister) {
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
          setError(data.error ?? "Registrering misslyckades.");
          return;
        }
        // Efter registrering: logga in direkt
        const loginRes = await fetch(`${apiUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const loginData = await loginRes.json().catch(() => ({}));
        if (!loginRes.ok) {
          setError(loginData.error ?? "Inloggning misslyckades.");
          return;
        }
        if (loginData.token) {
          if (typeof window !== "undefined") {
            localStorage.setItem("token", loginData.token);
            if (loginData.user) localStorage.setItem("user", JSON.stringify(loginData.user));
          }
          onOpenChange(false);
          onSuccess?.();
        }
      } else {
        const res = await fetch(`${apiUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Inloggning misslyckades.");
          return;
        }
        if (data.token) {
          if (typeof window !== "undefined") {
            localStorage.setItem("token", data.token);
            if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
          }
          onOpenChange(false);
          onSuccess?.();
        }
      }
    } catch (err) {
      const apiUrl = await getApiUrl().catch(() => FALLBACK_API_URL);
      setError(getConnectionErrorMessage(apiUrl));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setDisplayName("");
    setError(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isRegister ? "Skapa konto" : "Logga in"}
          </DialogTitle>
          <DialogDescription>
            {isRegister
              ? "Fyll i uppgifterna nedan för att registrera dig."
              : "Ange e-post och lösenord för att logga in."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          {isRegister && (
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
          )}
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
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={6}
            />
            {isRegister && (
              <p className="text-muted-foreground text-xs">
                Minst 6 tecken.
              </p>
            )}
          </div>

          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" variant="outlinePrimary" disabled={loading}>
              {loading ? <Spinner size="sm" /> : isRegister ? "Registrera" : "Logga in"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
