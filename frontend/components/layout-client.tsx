"use client";

import { useState, useEffect, useCallback } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import type { AppSidebarUser } from "@/components/app-sidebar";
import { AuthModal } from "@/components/auth-modal";
import type { AuthModalMode } from "@/components/auth-modal";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";

function getUserFromStorage(): AppSidebarUser | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("token");
  const raw = localStorage.getItem("user");
  if (!token || !raw) return null;
  try {
    const u = JSON.parse(raw) as { displayName?: string; avatarEmoji?: string | null; avatarImageData?: string | null };
    return u?.displayName
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

export function LayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AppSidebarUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthModalMode>("login");
  const [pendingFriendRequestsCount, setPendingFriendRequestsCount] = useState(0);

  useEffect(() => {
    setUser(getUserFromStorage());
  }, []);

  useEffect(() => {
    const onUserUpdated = () => setUser(getUserFromStorage());
    window.addEventListener("user-updated", onUserUpdated);
    return () => window.removeEventListener("user-updated", onUserUpdated);
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
    <SidebarProvider>
      <AppSidebar
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
        pendingFriendRequestsCount={pendingFriendRequestsCount}
      />
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-14 min-h-[44px] shrink-0 items-center gap-2 border-b border-border bg-[var(--warm-cream)] px-3">
          <SidebarTrigger className="-ml-1">
            <Menu className="size-5" aria-hidden />
          </SidebarTrigger>
          <Link href="/" className="flex items-center gap-2 font-semibold text-foreground hover:opacity-80">
            <Image src="/df161571-b42c-43f0-8b05-5c26a4bd9d01.png" alt="" width={24} height={24} className="size-6 shrink-0 object-contain" aria-hidden />
            <span>Kortspel</span>
          </Link>
        </header>
        <div className="flex min-h-0 w-full flex-1 flex-col">{children}</div>
      </SidebarInset>
      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        mode={authMode}
        onSuccess={() => setUser(getUserFromStorage())}
      />
    </SidebarProvider>
  );
}
