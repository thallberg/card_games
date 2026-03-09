"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, User, UserPlus, Users, Gamepad2, LogOut, LogIn, UserPlus as RegisterIcon, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NavbarUser = { displayName: string };

type NavbarProps = {
  user?: NavbarUser | null;
  onRegisterClick?: () => void;
  onLoginClick?: () => void;
  onLogout?: () => void;
  onInviteFriendClick?: () => void;
  /** Antal mottagna vänförfrågningar (visas som badge på Vänner-länken) */
  pendingFriendRequestsCount?: number;
};

export function Navbar({ user, onRegisterClick, onLoginClick, onLogout, onInviteFriendClick, pendingFriendRequestsCount = 0 }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobile = () => setMobileMenuOpen(false);

  const navContent = user ? (
    <>
      <Link
        href="/min-meny"
        className="hidden md:inline-flex items-center gap-0.5 text-muted-foreground text-sm hover:text-foreground transition-colors"
        onClick={closeMobile}
      >
        Hej, <span className="font-medium text-foreground">{user.displayName}</span>
        <ChevronRight className="size-3.5 shrink-0 opacity-70" aria-hidden />
      </Link>
      {onInviteFriendClick && (
        <Button variant="ghost" type="button" onClick={() => { onInviteFriendClick(); closeMobile(); }} className="min-h-11 justify-start md:justify-center w-full md:w-auto">
          <UserPlus className="size-4 md:mr-2 shrink-0" />
          Väninbjudan
        </Button>
      )}
      <Button variant="ghost" asChild className="relative min-h-11 justify-start md:justify-center w-full md:w-auto">
        <Link href="/vanner" onClick={closeMobile}>
          <Users className="size-4 md:mr-2 shrink-0" />
          Vänner
          {pendingFriendRequestsCount > 0 && (
            <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
              {pendingFriendRequestsCount > 9 ? "9+" : pendingFriendRequestsCount}
            </span>
          )}
        </Link>
      </Button>
      <Button variant="ghost" asChild className="min-h-11 justify-start md:justify-center w-full md:w-auto">
        <Link href="/spel" onClick={closeMobile}>
          <Gamepad2 className="size-4 md:mr-2 shrink-0" />
          Mina spel
        </Link>
      </Button>
      <Button variant="ghost" type="button" onClick={() => { onLogout?.(); closeMobile(); }} className="min-h-11 justify-start md:justify-center w-full md:w-auto">
        <LogOut className="size-4 md:mr-2 shrink-0" />
        Logga ut
      </Button>
    </>
  ) : (
    <>
      {onRegisterClick ? (
        <Button variant="ghost" type="button" onClick={() => { onRegisterClick(); closeMobile(); }} className="min-h-11 justify-start md:justify-center w-full md:w-auto">
          <RegisterIcon className="size-4 md:mr-2 shrink-0" />
          Registrera
        </Button>
      ) : (
        <Button variant="ghost" asChild className="min-h-11 justify-start md:justify-center w-full md:w-auto">
          <Link href="/registrera" onClick={closeMobile}>
            <RegisterIcon className="size-4 md:mr-2 shrink-0" />
            Registrera
          </Link>
        </Button>
      )}
      {onLoginClick ? (
        <Button type="button" onClick={() => { onLoginClick(); closeMobile(); }} className="min-h-11 w-full md:w-auto">
          <LogIn className="size-4 md:mr-2 shrink-0" />
          Logga in
        </Button>
      ) : (
        <Button asChild className="min-h-11 w-full md:w-auto">
          <Link href="/logga-in" onClick={closeMobile}>
            <LogIn className="size-4 md:mr-2 shrink-0" />
            Logga in
          </Link>
        </Button>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--border)] bg-[var(--warm-cream)]/95 backdrop-blur supports-backdrop-filter:bg-[var(--warm-cream)]/80">
      <div className="mx-auto flex h-14 min-h-[44px] max-w-7xl items-center px-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-foreground hover:opacity-80 min-h-[44px]"
        >
          <Image src="/df161571-b42c-43f0-8b05-5c26a4bd9d01.png" alt="" width={24} height={24} className="size-6 shrink-0 object-contain" aria-hidden />
          <span className="sr-only md:not-sr-only md:inline">Kortspel</span>
        </Link>

        <div className="flex flex-1" />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navContent}
        </nav>

        {/* Mobile: hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden size-11 shrink-0"
          onClick={() => setMobileMenuOpen((o) => !o)}
          aria-label={mobileMenuOpen ? "Stäng meny" : "Öppna meny"}
        >
          {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </Button>
      </div>

      {/* Mobile slide-down menu */}
      <div
        className={cn(
          "md:hidden overflow-hidden border-t bg-background transition-all duration-200 ease-out",
          mobileMenuOpen ? "max-h-[70vh]" : "max-h-0"
        )}
      >
        <nav className="flex flex-col gap-1 p-3 pb-4">
          {user && (
            <Link
              href="/min-meny"
              onClick={closeMobile}
              className="px-3 py-2 text-muted-foreground text-sm flex items-center gap-2 hover:text-foreground transition-colors"
            >
              <User className="size-4 shrink-0" />
              Hej, <span className="font-medium text-foreground">{user.displayName}</span>
              <ChevronRight className="size-3.5 shrink-0 opacity-70 ml-auto" aria-hidden />
            </Link>
          )}
          {navContent}
        </nav>
      </div>
    </header>
  );
}
