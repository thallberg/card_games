"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import type { NavbarUser } from "@/components/navbar/navbar";
import { AuthModal } from "@/components/auth-modal";
import type { AuthModalMode } from "@/components/auth-modal";
import { InviteFriendDialog } from "@/components/invite-friend-dialog";

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

  useEffect(() => {
    setUser(getUserFromStorage());
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <>
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
      {children}
    </>
  );
}
