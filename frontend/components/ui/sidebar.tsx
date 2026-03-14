"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";

type SidebarContext = {
  open: boolean;
  openMobile: boolean;
  setOpen: (v: boolean) => void;
  setOpenMobile: (v: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContext | null>(null);

function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const fn = () => setIsMobile(mql.matches);
    fn();
    mql.addEventListener("change", fn);
    return () => mql.removeEventListener("change", fn);
  }, []);
  return isMobile;
}

export function SidebarProvider({
  children,
  defaultOpen = false,
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [openMobile, setOpenMobile] = React.useState(false);
  const isMobile = useIsMobile();

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) setOpenMobile((v) => !v);
    else setOpen((v) => !v);
  }, [isMobile]);

  const value: SidebarContext = {
    open,
    openMobile,
    setOpen,
    setOpenMobile,
    isMobile,
    toggleSidebar,
  };

  return (
    <SidebarContext.Provider value={value}>
      <div
        className="flex min-h-[100dvh] w-full"
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-mobile": SIDEBAR_WIDTH_MOBILE,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function Sidebar({
  children,
  side = "left",
  className,
  ...props
}: React.ComponentProps<"div"> & { side?: "left" | "right" }) {
  const { open, openMobile, isMobile, setOpenMobile } = useSidebar();
  const visible = isMobile ? openMobile : open;

  return (
    <>
      {isMobile && visible && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-hidden
          onClick={() => setOpenMobile(false)}
        />
      )}
      <div
        data-state={visible ? "open" : "closed"}
        className={cn(
          "fixed top-0 z-50 flex h-[100dvh] flex-col border-r border-[var(--sidebar-border)] bg-[var(--warm-cream)] text-[var(--sidebar-foreground)] transition-transform duration-200 ease-in-out overflow-hidden",
          side === "left" ? "left-0" : "right-0",
          isMobile && "w-[var(--sidebar-width-mobile)] shadow-xl",
          !isMobile && "w-[var(--sidebar-width)]",
          !visible && (side === "left" ? "-translate-x-full" : "translate-x-full"),
          className
        )}
        style={
          !isMobile ? { width: "var(--sidebar-width)", minWidth: 0 } : undefined
        }
        {...props}
      >
        {children}
      </div>
    </>
  );
}

export function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex h-14 min-h-[44px] shrink-0 items-center gap-2 border-b border-[var(--sidebar-border)] px-3", className)}
      {...props}
    />
  );
}

export function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex-1 overflow-auto py-2", className)} {...props} />;
}

export function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("shrink-0 border-t border-[var(--sidebar-border)] p-2", className)}
      {...props}
    />
  );
}

export function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-2 py-1", className)} {...props} />;
}

export function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mb-1 mt-1 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--sidebar-foreground)]/70",
        className
      )}
      {...props}
    />
  );
}

export function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("space-y-0.5", className)} {...props} />;
}

export function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("flex w-full flex-col gap-0.5", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn("list-none", className)} {...props} />;
}

export function SidebarMenuButton({
  className,
  isActive,
  asChild,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  isActive?: boolean;
  asChild?: boolean;
}) {
  const baseClass = cn(
    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]",
    isActive && "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]",
    className
  );
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ className?: string }>, {
      className: cn(baseClass, (children as React.ReactElement<{ className?: string }>).props?.className),
    });
  }
  return (
    <button type="button" className={baseClass} {...(props as React.ComponentProps<"button">)}>
      {children}
    </button>
  );
}

export function SidebarMenuBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "ml-auto inline-flex size-5 items-center justify-center rounded-full bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)] text-xs font-medium",
        className
      )}
      {...props}
    />
  );
}

export function SidebarTrigger({ className, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className={cn(
        "inline-flex size-9 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      aria-label="Öppna eller stäng sidomeny"
      {...props}
    />
  );
}

export function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  const { open, isMobile } = useSidebar();
  const visible = isMobile ? true : open; // main area always visible on mobile (sidebar overlays)
  return (
    <main
      className={cn(
        "flex min-h-0 flex-1 flex-col transition-[margin] duration-200 ease-in-out",
        !isMobile && visible && "md:ml-[var(--sidebar-width)]",
        className
      )}
      {...props}
    />
  );
}

export { useSidebar };
