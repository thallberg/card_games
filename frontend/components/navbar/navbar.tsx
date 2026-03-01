"use client";

import Link from "next/link";
import { Spade } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-foreground hover:opacity-80"
        >
          <Spade className="size-6" aria-hidden />
          <span className="sr-only sm:not-sr-only sm:inline">Kortspel</span>
        </Link>

        <div className="flex flex-1 justify-center">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Kortspel
          </h1>
        </div>

        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <span className="text-muted-foreground text-sm">
                Hej, {user.displayName}
              </span>
              {onInviteFriendClick && (
                <Button variant="ghost" type="button" onClick={onInviteFriendClick}>
                  Väninbjudan
                </Button>
              )}
              <Button variant="ghost" asChild className="relative">
                <Link href="/vanner">
                  Vänner
                  {pendingFriendRequestsCount > 0 && (
                    <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                      {pendingFriendRequestsCount > 9 ? "9+" : pendingFriendRequestsCount}
                    </span>
                  )}
                </Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/spel">Mina spel</Link>
              </Button>
              <Button variant="ghost" type="button" onClick={onLogout}>
                Logga ut
              </Button>
            </>
          ) : (
            <>
              {onRegisterClick ? (
                <Button variant="ghost" type="button" onClick={onRegisterClick}>
                  Registrera
                </Button>
              ) : (
                <Button variant="ghost" asChild>
                  <Link href="/registrera">Registrera</Link>
                </Button>
              )}
              {onLoginClick ? (
                <Button type="button" onClick={onLoginClick}>
                  Logga in
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/logga-in">Logga in</Link>
                </Button>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
