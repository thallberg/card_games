"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { User, UserPlus, Users, Gamepad2, LogOut, LogIn, UserPlus as RegisterIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

export type AppSidebarUser = { displayName: string; avatarEmoji?: string | null; avatarImageData?: string | null };

type GameLink = {
  id: "fivehoundred" | "chicago" | "texasholdem" | "skitgubbe";
  label: string;
  singleHref: string;
  multiHref: string;
};

const GAME_LINKS: GameLink[] = [
  {
    id: "texasholdem",
    label: "Texas Hold'em",
    singleHref: "/games/texasholdem",
    multiHref: "/vanner?inviteGame=texasholdem",
  },
  {
    id: "fivehoundred",
    label: "500",
    singleHref: "/games/fivehoundred",
    multiHref: "/vanner?inviteGame=fivehoundred",
  },
  {
    id: "chicago",
    label: "Chicago",
    singleHref: "/games/chicago",
    multiHref: "/vanner?inviteGame=chicago",
  },
  {
    id: "skitgubbe",
    label: "Skitgubbe",
    singleHref: "/games/skitgubbe",
    multiHref: "/vanner?inviteGame=skitgubbe",
  },
];

function SidebarGameSectionContent({
  games,
  variant,
  closeSidebar,
}: {
  games: GameLink[];
  variant: "single" | "multi";
  closeSidebar: () => void;
}) {
  return (
    <SidebarGroupContent className="ml-2 border-l border-[var(--sidebar-border)] pl-2">
      <SidebarMenu>
        {games.map((game) => {
          const href = variant === "single" ? game.singleHref : game.multiHref;
          return (
            <SidebarMenuItem key={`${variant}-${game.id}`}>
              <SidebarMenuButton asChild className="text-xs">
                <Link href={href} onClick={closeSidebar} className="flex items-center gap-2">
                  <span className="flex items-center">
                    <span className="h-px w-4 bg-[var(--sidebar-border)]" />
                    <span className="ml-1 h-2 w-2 rounded-full border border-[var(--sidebar-foreground)]" />
                  </span>
                  <span>{game.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroupContent>
  );
}

type SidebarSession = {
  id: string;
  gameType: string;
  status: string;
};

function SidebarMyGamesSection({ closeSidebar }: { closeSidebar: () => void }) {
  const [sessions, setSessions] = React.useState<SidebarSession[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/gamesessions");
        if (res.status === 401) {
          if (!cancelled) setSessions([]);
          return;
        }
        const data = await res.json().catch(() => []);
        if (!cancelled) {
          setSessions(Array.isArray(data) ? (data as SidebarSession[]) : []);
        }
      } catch {
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const gameLabel = (gameType: string) => {
    switch (gameType) {
      case "FiveHundred":
        return "500";
      case "Chicago":
        return "Chicago";
      case "TexasHoldem":
        return "Texas Hold'em";
      case "Skitgubbe":
        return "Skitgubbe";
      default:
        return gameType;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "Waiting":
        return "väntar på start";
      case "InProgress":
        return "pågår";
      default:
        return status.toLowerCase();
    }
  };

  return (
    <SidebarGroupContent className="ml-2 border-l border-[var(--sidebar-border)] pl-2">
      <SidebarMenu>
        {loading && (
          <SidebarMenuItem>
            <span className="text-xs text-muted-foreground">Laddar spel...</span>
          </SidebarMenuItem>
        )}
        {!loading && (sessions == null || sessions.length === 0) && (
          <SidebarMenuItem>
            <span className="text-xs text-muted-foreground">Inga pågående eller väntande spel ännu.</span>
          </SidebarMenuItem>
        )}
        {!loading &&
          sessions &&
          sessions.length > 0 &&
          sessions.map((s) => (
            <SidebarMenuItem key={s.id}>
              <SidebarMenuButton asChild className="text-xs">
                <Link href="/spel" onClick={closeSidebar} className="flex items-center gap-2">
                  <span className="flex items-center">
                    <span className="h-px w-4 bg-[var(--sidebar-border)]" />
                    <span className="ml-1 h-2 w-2 rounded-full border border-[var(--sidebar-foreground)]" />
                  </span>
                  <span className="truncate">
                    {gameLabel(s.gameType)}{" "}
                    <span className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                      – {statusLabel(s.status)}
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
      </SidebarMenu>
    </SidebarGroupContent>
  );
}

type AppSidebarProps = {
  user?: AppSidebarUser | null;
  onRegisterClick?: () => void;
  onLoginClick?: () => void;
  onLogout?: () => void;
  pendingFriendRequestsCount?: number;
};

export function AppSidebar({
  user,
  onRegisterClick,
  onLoginClick,
  onLogout,
  pendingFriendRequestsCount = 0,
}: AppSidebarProps) {
  const { setOpenMobile, isMobile } = useSidebar();

  const closeSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <Link
          href="/"
          onClick={closeSidebar}
          className="flex items-center gap-2 font-semibold text-[var(--sidebar-foreground)] hover:opacity-80"
        >
          <Image
            src="/df161571-b42c-43f0-8b05-5c26a4bd9d01.png"
            alt=""
            width={24}
            height={24}
            className="size-6 shrink-0 object-contain"
            aria-hidden
          />
          <span>Kortspel</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <Collapsible defaultOpen>
            <CollapsibleTrigger
              className={cn(
                "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--sidebar-foreground)]/70 hover:bg-[var(--sidebar-accent)]/40"
              )}
            >
              <span className="flex items-center gap-2">
                <User className="size-4 shrink-0" />
                <span className="flex-1 text-left px-0.5">Single player</span>
              </span>
              <ChevronDown className="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGameSectionContent
                games={GAME_LINKS}
                variant="single"
                closeSidebar={closeSidebar}
              />
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
        <SidebarGroup>
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger
              className={cn(
                "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--sidebar-foreground)]/70 hover:bg-[var(--sidebar-accent)]/40"
              )}
            >
              <span className="flex items-center gap-2">
                <Users className="size-4 shrink-0" />
                <span className="flex-1 text-left px-0.5">Multi player</span>
              </span>
              <ChevronDown className="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGameSectionContent
                games={GAME_LINKS}
                variant="multi"
                closeSidebar={closeSidebar}
              />
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
        <SidebarGroup>
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger
              className={cn(
                "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--sidebar-foreground)]/70 hover:bg-[var(--sidebar-accent)]/40"
              )}
            >
              <span className="flex items-center gap-2">
                <Gamepad2 className="size-4 shrink-0" />
                <span className="flex-1 text-left px-0.5">Mina spel</span>
              </span>
              <ChevronDown
                className="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
                aria-hidden
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMyGamesSection closeSidebar={closeSidebar} />
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
        {!user && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {onRegisterClick ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => { onRegisterClick(); closeSidebar(); }}>
                      <RegisterIcon className="size-4 shrink-0" />
                      Registrera
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/registrera" onClick={closeSidebar}>
                        <RegisterIcon className="size-4 shrink-0" />
                        Registrera
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {onLoginClick ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => { onLoginClick(); closeSidebar(); }}
                      className="border border-primary bg-transparent text-primary hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
                    >
                      <LogIn className="size-4 shrink-0" />
                      Logga in
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link
                        href="/logga-in"
                        onClick={closeSidebar}
                        className="border border-primary bg-transparent text-primary hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
                      >
                        <LogIn className="size-4 shrink-0" />
                        Logga in
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      {user && (
        <SidebarFooter>
          <Collapsible defaultOpen={false} className="px-2 pb-2">
            <CollapsibleTrigger
              className={cn(
                "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
              )}
            >
              <Avatar className="size-8 shrink-0 rounded-full bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]">
                {user.avatarImageData && (
                  <AvatarImage src={user.avatarImageData} alt={user.displayName} />
                )}
                <AvatarFallback aria-hidden>
                  {user.avatarEmoji ?? user.displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{user.displayName}</span>
              <ChevronDown className="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Separator className="my-2 bg-[var(--sidebar-border)]" />
              <div className="space-y-0.5">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/vaninbjudan" onClick={closeSidebar}>
                        <UserPlus className="size-4 shrink-0" />
                        Bjud in vän
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/vanner" onClick={closeSidebar} className="flex items-center gap-2">
                        <Users className="size-4 shrink-0" />
                        Vänner
                        {pendingFriendRequestsCount > 0 && (
                          <SidebarMenuBadge>
                            {pendingFriendRequestsCount > 9 ? "9+" : pendingFriendRequestsCount}
                          </SidebarMenuBadge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/spel" onClick={closeSidebar}>
                        <Gamepad2 className="size-4 shrink-0" />
                        Mina spel
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/min-meny" onClick={closeSidebar} className="flex items-center gap-2">
                        <User className="size-4 shrink-0" />
                        <span className="truncate">Min profil</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => { onLogout?.(); closeSidebar(); }}>
                      <LogOut className="size-4 shrink-0" />
                      Logga ut
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
