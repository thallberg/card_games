"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { AuthModal } from "@/components/auth-modal";
import type { AuthModalMode } from "@/components/auth-modal";

export function LayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthModalMode>("login");

  return (
    <>
      <Navbar
        onRegisterClick={() => {
          setAuthMode("register");
          setAuthOpen(true);
        }}
        onLoginClick={() => {
          setAuthMode("login");
          setAuthOpen(true);
        }}
      />
      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        mode={authMode}
      />
      {children}
    </>
  );
}
