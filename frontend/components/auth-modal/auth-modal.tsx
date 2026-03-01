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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5236";

function getConnectionErrorMessage(): string {
  if (typeof window === "undefined") return "Kunde inte ansluta till servern.";
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (isLocal) {
    return "Kunde inte ansluta till servern. Starta backend med ’dotnet run’ i mappen backend (krävs för registrering och inloggning).";
  }
  return "Kunde inte ansluta till backend. I produktion måste API:n vara deployad (t.ex. Azure App Service) och du måste sätta miljövariabeln NEXT_PUBLIC_API_URL i Vercel till din API-URL.";
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
      if (isRegister) {
        const res = await fetch(`${API_URL}/api/auth/register`, {
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
        const loginRes = await fetch(`${API_URL}/api/auth/login`, {
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
          typeof window !== "undefined" &&
            localStorage.setItem("token", loginData.token);
          onOpenChange(false);
          onSuccess?.();
        }
      } else {
        const res = await fetch(`${API_URL}/api/auth/login`, {
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
          typeof window !== "undefined" &&
            localStorage.setItem("token", data.token);
          onOpenChange(false);
          onSuccess?.();
        }
      }
    } catch {
      setError(getConnectionErrorMessage());
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
            <Button type="submit" disabled={loading}>
              {loading ? "Vänta..." : isRegister ? "Registrera" : "Logga in"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
