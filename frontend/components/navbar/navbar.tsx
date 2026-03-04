"use client";

import { useState } from "react";
import Link from "next/link";
import { Spade, Menu, X, User, UserPlus, Users, Gamepad2, LogOut, LogIn, UserPlus as RegisterIcon } from "lucide-react";
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
      <span className="hidden md:inline text-muted-foreground text-sm">
        Hej, {user.displayName}
      </span>
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
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 min-h-[44px] max-w-7xl items-center px-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-foreground hover:opacity-80 min-h-[44px]"
        >
          <Spade className="size-6 shrink-0" aria-hidden />
          <span className="sr-only md:not-sr-only md:inline">Kortspel</span>
        </Link>

        <div className="flex flex-1 justify-center">
          <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
            Kortspel
          </h1>
        </div>

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
            <p className="px-3 py-2 text-muted-foreground text-sm flex items-center gap-2">
              <User className="size-4" />
              Hej, {user.displayName}
            </p>
          )}
          {navContent}
        </nav>
      </div>
    </header>
  );
}
