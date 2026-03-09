"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

const AVATAR_EMOJIS = ["😀", "😎", "🎮", "👑", "🌟", "🎯", "🃏", "🍀", "⚡", "🏆"] as const;

function getUserFromStorage(): { displayName: string; avatarEmoji?: string | null } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as { displayName?: string; avatarEmoji?: string | null };
    return u?.displayName != null ? { displayName: u.displayName, avatarEmoji: u.avatarEmoji ?? null } : null;
  } catch {
    return null;
  }
}

function updateUserInStorage(updates: { displayName?: string; avatarEmoji?: string | null }) {
  const raw = localStorage.getItem("user");
  if (!raw) return;
  try {
    const u = JSON.parse(raw) as Record<string, unknown>;
    if (updates.displayName !== undefined) u.displayName = updates.displayName;
    if (updates.avatarEmoji !== undefined) u.avatarEmoji = updates.avatarEmoji;
    localStorage.setItem("user", JSON.stringify(u));
    window.dispatchEvent(new Event("user-updated"));
  } catch {
    /* ignore */
  }
}

export default function MinMenyPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ displayName: string; avatarEmoji?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [displayNameSaving, setDisplayNameSaving] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [displayNameSuccess, setDisplayNameSuccess] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    const u = getUserFromStorage();
    if (!u) {
      router.push("/");
      return;
    }
    setUser(u);
    setDisplayName(u.displayName);
    setSelectedEmoji(u.avatarEmoji ?? null);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const onUpdated = () => setUser(getUserFromStorage());
    window.addEventListener("user-updated", onUpdated);
    return () => window.removeEventListener("user-updated", onUpdated);
  }, []);

  const handleSaveDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      setDisplayNameError("Ange ett visningsnamn.");
      return;
    }
    setDisplayNameError(null);
    setDisplayNameSuccess(false);
    setDisplayNameSaving(true);
    try {
      const res = await apiFetch("/api/auth/me/displayname", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDisplayNameError((data as { error?: string }).error ?? "Kunde inte spara.");
        return;
      }
      updateUserInStorage({ displayName: trimmed });
      setDisplayNameSuccess(true);
      setTimeout(() => setDisplayNameSuccess(false), 3000);
    } catch {
      setDisplayNameError("Nätverksfel.");
    } finally {
      setDisplayNameSaving(false);
    }
  };

  const handleSaveAvatar = async (emoji: string | null) => {
    setAvatarError(null);
    setAvatarSuccess(false);
    setAvatarSaving(true);
    try {
      const res = await apiFetch("/api/auth/me/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAvatarError((data as { error?: string }).error ?? "Kunde inte spara.");
        return;
      }
      setSelectedEmoji(emoji);
      updateUserInStorage({ avatarEmoji: emoji });
      setAvatarSuccess(true);
      setTimeout(() => setAvatarSuccess(false), 3000);
    } catch {
      setAvatarError("Nätverksfel.");
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword.length < 6) {
      setPasswordError("Nytt lösenord måste vara minst 6 tecken.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordError("Lösenorden matchar inte.");
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await apiFetch("/api/auth/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPassword,
          newPassword: newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPasswordError((data as { error?: string }).error ?? "Kunde inte byta lösenord.");
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch {
      setPasswordError("Nätverksfel.");
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8">
        <p className="text-muted-foreground">Laddar…</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Min meny</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Hantera ditt konto och visningsnamn.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-4 sm:p-6">
        <h2 className="text-lg font-medium mb-4">Byta användarnamn</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Detta namn visas för andra i spel (t.ex. Skitgubbe, 500).
        </p>
        <form onSubmit={handleSaveDisplayName} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Visningsnamn</Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="T.ex. Tobbe"
              maxLength={100}
              disabled={displayNameSaving}
              autoComplete="username"
            />
          </div>
          {displayNameError && (
            <p className="text-sm text-destructive">{displayNameError}</p>
          )}
          {displayNameSuccess && (
            <p className="text-sm text-green-600 dark:text-green-400">Visningsnamnet är sparat.</p>
          )}
          <Button type="submit" disabled={displayNameSaving}>
            {displayNameSaving ? "Sparar…" : "Spara visningsnamn"}
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 sm:p-6">
        <h2 className="text-lg font-medium mb-4">Avatar i spel</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Välj en emoji som visas efter ditt namn i alla spel (Skitgubbe, 500, m.fl.).
        </p>
        <div className="flex flex-wrap gap-2">
          {AVATAR_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleSaveAvatar(selectedEmoji === emoji ? null : emoji)}
              disabled={avatarSaving}
              className={`text-2xl w-12 h-12 rounded-lg border-2 transition-colors flex items-center justify-center ${
                selectedEmoji === emoji
                  ? "border-primary bg-primary/15"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
              title={selectedEmoji === emoji ? "Klicka för att ta bort" : "Välj som avatar"}
            >
              {emoji}
            </button>
          ))}
        </div>
        {selectedEmoji && (
          <p className="text-sm text-muted-foreground mt-2">
            Vald: {selectedEmoji} – klicka igen för att ta bort.
          </p>
        )}
        {avatarError && <p className="text-sm text-destructive mt-2">{avatarError}</p>}
        {avatarSuccess && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-2">Avataren är sparad.</p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4 sm:p-6">
        <h2 className="text-lg font-medium mb-4">Byta lösenord</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Nuvarande lösenord</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={passwordSaving}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nytt lösenord</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minst 6 tecken"
              minLength={6}
              disabled={passwordSaving}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPasswordConfirm">Bekräfta nytt lösenord</Label>
            <Input
              id="newPasswordConfirm"
              type="password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              disabled={passwordSaving}
              autoComplete="new-password"
            />
          </div>
          {passwordError && (
            <p className="text-sm text-destructive">{passwordError}</p>
          )}
          {passwordSuccess && (
            <p className="text-sm text-green-600 dark:text-green-400">Lösenordet är bytt.</p>
          )}
          <Button type="submit" disabled={passwordSaving}>
            {passwordSaving ? "Byter…" : "Byta lösenord"}
          </Button>
        </form>
      </section>

      <p className="text-muted-foreground text-sm">
        <Link href="/" className="underline hover:text-foreground">Tillbaka till startsidan</Link>
      </p>
    </div>
  );
}
