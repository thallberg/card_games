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
import { Separator } from "@/components/ui/separator";
import { User, UserPlus, Users, Gamepad2, LogOut, LogIn, UserPlus as RegisterIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type AppSidebarUser = { displayName: string; avatarEmoji?: string | null };

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
          <SidebarGroupContent>
            <SidebarMenu>
              {user ? (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/vaninbjudan" onClick={closeSidebar}>
                        <UserPlus className="size-4 shrink-0" />
                        Väninbjudan
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
                </>
              ) : (
                <>
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
                        className="bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)] hover:opacity-90"
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
                          className="bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)] hover:opacity-90"
                        >
                          <LogIn className="size-4 shrink-0" />
                          Logga in
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {user && (
        <SidebarFooter>
          <Collapsible defaultOpen={false} className="px-2 pb-2">
            <CollapsibleTrigger
              className={cn(
                "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
              )}
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] text-sm font-medium"
                aria-hidden
              >
                {user.avatarEmoji ?? user.displayName.charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{user.displayName}</span>
              <ChevronDown className="ml-auto size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Separator className="my-2 bg-[var(--sidebar-border)]" />
              <div className="space-y-0.5">
                <SidebarMenu>
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
