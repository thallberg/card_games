"use client";

import { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/navbar";
import type { NavbarUser } from "@/components/navbar/navbar";
import { AuthModal } from "@/components/auth-modal";
import type { AuthModalMode } from "@/components/auth-modal";
import { InviteFriendDialog } from "@/components/invite-friend-dialog";
import { apiFetch } from "@/lib/api";

function getUserFromStorage(): NavbarUser | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("token");
  const raw = localStorage.getItem("user");
  if (!token || !raw) return null;
  try {
    const u = JSON.parse(raw) as { displayName?: string };
    return u?.displayName ? { displayName: u.displayName } : null;
  } catch {
    return null;
  }
}

export function LayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<NavbarUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthModalMode>("login");
  const [inviteFriendOpen, setInviteFriendOpen] = useState(false);
  const [pendingFriendRequestsCount, setPendingFriendRequestsCount] = useState(0);

  useEffect(() => {
    setUser(getUserFromStorage());
  }, []);

  const POLL_MS = 60_000;
  const PAUSE_AFTER_ERROR_MS = 5 * 60 * 1000; // 5 min paus vid t.ex. 500 så vi inte spammer konsolen lokalt

  const fetchPendingCount = useCallback(async (): Promise<boolean> => {
    try {
      const res = await apiFetch("/api/friends/requests/received");
      if (res.ok) {
        const data = await res.json().catch(() => []);
        setPendingFriendRequestsCount(Array.isArray(data) ? data.length : 0);
        return true;
      }
      setPendingFriendRequestsCount(0);
      return false; // t.ex. 401/500 – pausa polling
    } catch {
      setPendingFriendRequestsCount(0);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setPendingFriendRequestsCount(0);
      return;
    }
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleNext = (success: boolean) => {
      if (cancelled) return;
      const delay = success ? POLL_MS : PAUSE_AFTER_ERROR_MS;
      timeoutId = setTimeout(() => {
        fetchPendingCount().then(scheduleNext);
      }, delay);
    };
    fetchPendingCount().then(scheduleNext);
    const onRefresh = () => fetchPendingCount().then((ok) => ok && scheduleNext(true));
    window.addEventListener("friend-requests-changed", onRefresh);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      window.removeEventListener("friend-requests-changed", onRefresh);
    };
  }, [user, fetchPendingCount]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <Navbar
        user={user}
        onRegisterClick={() => {
          setAuthMode("register");
          setAuthOpen(true);
        }}
        onLoginClick={() => {
          setAuthMode("login");
          setAuthOpen(true);
        }}
        onLogout={handleLogout}
        onInviteFriendClick={() => setInviteFriendOpen(true)}
        pendingFriendRequestsCount={pendingFriendRequestsCount}
      />
      <InviteFriendDialog
        open={inviteFriendOpen}
        onOpenChange={setInviteFriendOpen}
      />
      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        mode={authMode}
        onSuccess={() => setUser(getUserFromStorage())}
      />
      <div className="flex flex-1 flex-col min-h-0">{children}</div>
    </div>
  );
}
