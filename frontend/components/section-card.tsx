"use client";

import type { LucideIcon } from "lucide-react";

type SectionCardProps = {
  /** Pastel color: lavender | mint | peach | sage | sky | sand */
  variant?: "lavender" | "mint" | "peach" | "sage" | "sky" | "sand";
  /** Optional icon to show next to title */
  icon?: LucideIcon;
  /** Section title */
  title?: React.ReactNode;
  /** Content */
  children: React.ReactNode;
  className?: string;
};

const variantClasses: Record<SectionCardProps["variant"] & string, string> = {
  lavender: "bg-[var(--pastel-lavender)]/50 border-[var(--pastel-lavender)]/50 border-l-4 border-l-[var(--accent-lavender)]",
  mint: "bg-[var(--pastel-mint)]/50 border-[var(--pastel-mint)]/50 border-l-4 border-l-[var(--accent-mint)]",
  peach: "bg-[var(--pastel-peach)]/50 border-[var(--pastel-peach)]/50 border-l-4 border-l-[var(--accent-peach)]",
  sage: "bg-[var(--pastel-sage)]/50 border-[var(--pastel-sage)]/50 border-l-4 border-l-[var(--accent-sage)]",
  sky: "bg-[var(--pastel-sky)]/60 border-[var(--pastel-sky)]/40",
  sand: "bg-[var(--warm-sand)]/40 border-[var(--border)]",
};

export function SectionCard({
  variant = "peach",
  icon: Icon,
  title,
  children,
  className = "",
}: SectionCardProps) {
  const base = "rounded-xl border p-4 sm:p-5 shadow-sm";
  const colors = variantClasses[variant] ?? variantClasses.peach;

  return (
    <section className={`${base} ${colors} ${className}`}>
      {title != null && (
        <div className="mb-3 flex items-center gap-3">
          {Icon && (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-foreground/10">
              <Icon className="size-5 text-foreground" aria-hidden />
            </div>
          )}
          <h2 className="text-base sm:text-lg font-semibold text-foreground">{title}</h2>
        </div>
      )}
      {children}
    </section>
  );
}
