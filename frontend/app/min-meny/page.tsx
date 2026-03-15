"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ChevronDown, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const AVATAR_EMOJIS = ["😀", "😎", "🎮", "👑", "🌟", "🎯", "🃏", "🍀", "⚡", "🏆"] as const;

type LocalUser = { displayName: string; avatarEmoji?: string | null; avatarImageData?: string | null };

function getUserFromStorage(): LocalUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as { displayName?: string; avatarEmoji?: string | null; avatarImageData?: string | null };
    return u?.displayName != null
      ? {
          displayName: u.displayName,
          avatarEmoji: u.avatarEmoji ?? null,
          avatarImageData: u.avatarImageData ?? null,
        }
      : null;
  } catch {
    return null;
  }
}

function updateUserInStorage(updates: { displayName?: string; avatarEmoji?: string | null; avatarImageData?: string | null }) {
  const raw = localStorage.getItem("user");
  if (!raw) return;
  try {
    const u = JSON.parse(raw) as Record<string, unknown>;
    if (updates.displayName !== undefined) u.displayName = updates.displayName;
    if (updates.avatarEmoji !== undefined) u.avatarEmoji = updates.avatarEmoji;
    if (updates.avatarImageData !== undefined) u.avatarImageData = updates.avatarImageData;
    localStorage.setItem("user", JSON.stringify(u));
    window.dispatchEvent(new Event("user-updated"));
  } catch {
    /* ignore */
  }
}

export default function MinMenyPage() {
  const router = useRouter();
  const [user, setUser] = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState(false);
  const [avatarImageData, setAvatarImageData] = useState<string | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

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

  const [finishedSessions, setFinishedSessions] = useState<Array<{
    id: string;
    gameType: string;
    leaderDisplayName: string;
    createdAt: string;
  }>>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [friends, setFriends] = useState<Array<{ id: string; displayName: string; friendsSince: string }>>([]);

  const loadFinishedSessions = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await apiFetch("/api/gamesessions");
      if (res.status === 401) return;
      const data = await res.json().catch(() => []);
      const list = Array.isArray(data) ? data : [];
      const finished = list.filter((s: { status?: string }) => s.status === "Finished");
      setFinishedSessions(
        finished.map((s: { id: string; gameType: string; leaderDisplayName?: string; createdAt?: string }) => ({
          id: s.id,
          gameType: s.gameType === "FiveHundred" ? "500" : s.gameType === "TexasHoldem" ? "Texas Hold'em" : s.gameType === "Chicago" ? "Chicago" : s.gameType === "Skitgubbe" ? "Skitgubbe" : s.gameType,
          leaderDisplayName: s.leaderDisplayName ?? "—",
          createdAt: s.createdAt ?? "",
        }))
      );
    } catch {
      /* ignore */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    const u = getUserFromStorage();
    if (!u) {
      router.push("/");
      return;
    }
    setUser(u);
    setDisplayName(u.displayName);
    setSelectedEmoji(u.avatarEmoji ?? null);
    setAvatarImageData(u.avatarImageData ?? null);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const u = getUserFromStorage();
    if (!u) return;
    apiFetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) return;
        return res.json();
      })
      .then((data: { displayName?: string; avatarEmoji?: string | null; avatarImageData?: string | null } | undefined) => {
        if (!data) return;
        const next = {
          displayName: data.displayName ?? u.displayName,
          avatarEmoji: data.avatarEmoji ?? null,
          avatarImageData: data.avatarImageData ?? null,
        };
        updateUserInStorage(next);
        setUser(next);
        setDisplayName(next.displayName);
        setSelectedEmoji(next.avatarEmoji ?? null);
        setAvatarImageData(next.avatarImageData ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onUpdated = () => setUser(getUserFromStorage());
    window.addEventListener("user-updated", onUpdated);
    return () => window.removeEventListener("user-updated", onUpdated);
  }, []);

  const loadFriends = useCallback(async () => {
    try {
      const res = await apiFetch("/api/friends");
      if (res.status === 401) return;
      const data = await res.json().catch(() => []);
      const list = Array.isArray(data) ? data : [];
      setFriends(list.map((f: { id: string; displayName?: string; friendsSince?: string }) => ({
        id: f.id,
        displayName: f.displayName ?? "—",
        friendsSince: f.friendsSince ?? "",
      })));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadFinishedSessions();
  }, [loadFinishedSessions]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

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
        const msg = (data as { error?: string }).error ?? "Kunde inte spara.";
        setDisplayNameError(msg);
        toast.error(msg);
        return;
      }
      updateUserInStorage({ displayName: trimmed });
      setDisplayNameSuccess(true);
      toast.success("Visningsnamn sparat");
      setTimeout(() => setDisplayNameSuccess(false), 3000);
    } catch {
      setDisplayNameError("Nätverksfel.");
      toast.error("Nätverksfel.");
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
      toast.success("Avatar sparat");
      setTimeout(() => setAvatarSuccess(false), 3000);
    } catch {
      setAvatarError("Nätverksfel.");
      toast.error("Nätverksfel.");
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
        const msg = (data as { error?: string }).error ?? "Kunde inte byta lösenord.";
        setPasswordError(msg);
        toast.error(msg);
        return;
      }
      setPasswordSuccess(true);
      toast.success("Lösenord bytt");
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch {
      setPasswordError("Nätverksfel.");
      toast.error("Nätverksfel.");
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] flex-1 items-center justify-center">
        <Spinner size="xl" className="text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Min meny</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Hantera ditt konto och visningsnamn.
        </p>
      </div>

      <div className="w-full">
        <div className="w-full rounded-lg border border-border bg-card p-4 sm:p-6">
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="group flex w-full items-center justify-between text-left">
              <h2 className="text-lg font-medium">Spelarnamn</h2>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <form onSubmit={handleSaveDisplayName} className="space-y-4 pt-2">
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
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Visningsnamnet är sparat.
                  </p>
                )}
                <Button type="submit" variant="outlinePrimary" disabled={displayNameSaving}>
                  {displayNameSaving ? "Sparar…" : "Spara visningsnamn"}
                </Button>
              </form>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <div className="w-full">
        <div className="w-full rounded-lg border border-border bg-card p-4 sm:p-6">
          <Collapsible>
            <CollapsibleTrigger className="group flex w-full items-center justify-between text-left">
              <h2 className="text-lg font-medium">Avatar & visningsbild</h2>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex items-center gap-4 pt-2">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                  {avatarImageData ? (
                    // Enkel preview av uppladdad bild
                    <img src={avatarImageData} alt="Avatar" className="h-full w-full object-cover" />
                  ) : selectedEmoji ? (
                    <span className="text-3xl">{selectedEmoji}</span>
                  ) : (
                    <span className="text-xl text-muted-foreground">
                      {displayName ? displayName.charAt(0).toUpperCase() : "?"}
                    </span>
                  )}
                </div>
                <div className="flex-1 space-y-2 text-sm text-muted-foreground">
                  <p>Välj antingen en emoji eller ladda upp en egen bild.</p>
                  <div className="space-y-1">
                    <Label htmlFor="avatar-upload">Egen bild</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        ref={avatarFileInputRef}
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setAvatarError(null);
                        setAvatarSaving(true);
                        const reader = new FileReader();
                        reader.onload = async () => {
                          const result = typeof reader.result === "string" ? reader.result : null;
                          if (!result) {
                            setAvatarSaving(false);
                            return;
                          }
                          try {
                            const res = await apiFetch("/api/auth/me/avatar-image", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ avatarImageData: result }),
                            });
                            const data = await res.json().catch(() => ({}));
                            if (!res.ok) {
                              setAvatarError((data as { error?: string }).error ?? "Kunde inte spara bilden.");
                              return;
                            }
                            setAvatarImageData(result);
                            updateUserInStorage({ avatarImageData: result });
                            setAvatarSuccess(true);
                            setTimeout(() => setAvatarSuccess(false), 3000);
                            window.dispatchEvent(new Event("user-updated"));
                          } catch {
                            setAvatarError("Nätverksfel.");
                          } finally {
                            setAvatarSaving(false);
                          }
                        };
                        reader.readAsDataURL(file);
                        e.target.value = "";
                      }}
                        disabled={avatarSaving}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={avatarSaving}
                        onClick={() => avatarFileInputRef.current?.click()}
                      >
                        Välj bild
                      </Button>
                    </div>
                    {avatarImageData && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-1"
                        disabled={avatarSaving}
                        onClick={async () => {
                          setAvatarError(null);
                          setAvatarSaving(true);
                          try {
                            const res = await apiFetch("/api/auth/me/avatar-image", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ avatarImageData: null }),
                            });
                            const data = await res.json().catch(() => ({}));
                            if (!res.ok) {
                              setAvatarError((data as { error?: string }).error ?? "Kunde inte ta bort bilden.");
                              return;
                            }
                            setAvatarImageData(null);
                            setSelectedEmoji(null);
                            updateUserInStorage({ avatarImageData: null, avatarEmoji: null });
                            setAvatarSuccess(true);
                            setTimeout(() => setAvatarSuccess(false), 3000);
                            window.dispatchEvent(new Event("user-updated"));
                          } catch {
                            setAvatarError("Nätverksfel.");
                          } finally {
                            setAvatarSaving(false);
                          }
                        }}
                      >
                        Ta bort bild
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
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
              {selectedEmoji && !avatarImageData && (
                <p className="text-sm text-muted-foreground mt-2">
                  Vald emoji: {selectedEmoji} – klicka igen för att ta bort.
                </p>
              )}
              {avatarError && <p className="text-sm text-destructive mt-2">{avatarError}</p>}
              {avatarSuccess && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                  Avataren är sparad.
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <div className="w-full">
        <div className="w-full rounded-lg border border-border bg-card p-4 sm:p-6">
          <Collapsible>
            <CollapsibleTrigger className="group flex w-full items-center justify-between text-left">
              <h2 className="text-lg font-medium">Byta lösenord</h2>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <form onSubmit={handleChangePassword} className="space-y-4 pt-2">
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
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Lösenordet är bytt.
                  </p>
                )}
                <Button type="submit" variant="outlinePrimary" disabled={passwordSaving}>
                  {passwordSaving ? "Byter…" : "Byta lösenord"}
                </Button>
              </form>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <div className="w-full">
        <div className="w-full rounded-lg border border-border bg-card p-4 sm:p-6">
          <Collapsible>
            <CollapsibleTrigger className="group flex w-full items-center justify-between text-left">
              <span className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <h2 className="text-lg font-medium">Statistik</h2>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-3 pt-2">
                <p className="text-muted-foreground text-xs">
                  Här visas det senaste av de tre. För mer statistik, gå till statistik-sidan.
                </p>
                {historyLoading ? (
                  <p className="text-muted-foreground text-sm">Laddar...</p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                      <div className="rounded-lg border border-[var(--border)] bg-muted/30 p-3 text-sm">
                        <p className="text-muted-foreground text-xs font-medium mb-1">Vunna match</p>
                        <p className="font-medium">—</p>
                      </div>
                      <div className="rounded-lg border border-[var(--border)] bg-muted/30 p-3 text-sm">
                        <p className="text-muted-foreground text-xs font-medium mb-1">Spelade kortspel</p>
                        <p className="font-medium">{finishedSessions.length > 0 ? finishedSessions[0].gameType : "—"}</p>
                      </div>
                      <div className="rounded-lg border border-[var(--border)] bg-muted/30 p-3 text-sm">
                        <p className="text-muted-foreground text-xs font-medium mb-1">Tillagda vän</p>
                        <p className="font-medium truncate">
                          {friends.length > 0
                            ? (() => {
                                const sorted = [...friends].sort((a, b) => (b.friendsSince || "").localeCompare(a.friendsSince || ""));
                                return sorted[0]?.displayName ?? "—";
                              })()
                            : "—"}
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/statistik"
                      className="inline-block text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                    >
                      Till statistik →
                    </Link>
                  </>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        <Link href="/" className="underline hover:text-foreground">Tillbaka till startsidan</Link>
      </p>
    </div>
  );
}
