import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type ResultAction = {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "outlinePrimary" | "outlineSecondary" | "destructive";
  className?: string;
};

type GameResultPanelProps = {
  title?: ReactNode;
  message: ReactNode;
  details?: ReactNode;
  className?: string;
  actions?: ResultAction[];
};

export function GameResultPanel({
  title,
  message,
  details,
  className,
  actions,
}: GameResultPanelProps) {
  return (
    <div className={className ?? "rounded-lg border border-[var(--border)] bg-[var(--warm-peach)]/50 p-4 text-center"}>
      {title ? <h2 className="text-lg font-semibold">{title}</h2> : null}
      <p className={title ? "mt-2 font-medium" : "font-medium"}>{message}</p>
      {details ? <div className="mt-1 text-sm text-muted-foreground">{details}</div> : null}
      {actions && actions.length > 0 ? (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {actions.map((action, i) => (
            <Button
              key={`${action.label}-${i}`}
              variant={action.variant ?? "outlinePrimary"}
              onClick={action.onClick}
              className={action.className}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

