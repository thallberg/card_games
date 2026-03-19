import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PlayerInfoCardProps = {
  name: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  rightAdornment?: ReactNode;
  isActive?: boolean;
  className?: string;
  children?: ReactNode;
};

export function PlayerInfoCard({
  name,
  subtitle,
  meta,
  rightAdornment,
  isActive = false,
  className,
  children,
}: PlayerInfoCardProps) {
  return (
    <div
      className={cn(
        "flex w-50 min-w-0 flex-col gap-0.5 rounded-lg border border-border bg-card p-1",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full ring-2",
            isActive ? "bg-green-500 ring-green-500/40" : "bg-transparent ring-transparent"
          )}
          aria-hidden
        />
        <span className="min-w-0 wrap-break-word font-medium">{name}</span>
        {rightAdornment ? <span className="ml-0.5" aria-hidden>{rightAdornment}</span> : null}
      </div>
      {subtitle ? <span className="min-w-0 wrap-break-word text-muted-foreground">{subtitle}</span> : null}
      {meta ? <span className="min-w-0 wrap-break-word text-muted-foreground">{meta}</span> : null}
      {children ? <div className="min-w-0 wrap-break-word">{children}</div> : null}
    </div>
  );
}
