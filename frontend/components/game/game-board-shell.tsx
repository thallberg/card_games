import type { ReactNode } from "react";

type GameBoardShellProps = {
  children: ReactNode;
  maxWidth?: "2xl" | "4xl";
  spacingClassName?: string;
  className?: string;
};

export function GameBoardShell({
  children,
  maxWidth = "4xl",
  spacingClassName = "space-y-4 sm:space-y-6",
  className,
}: GameBoardShellProps) {
  const widthClass = maxWidth === "2xl" ? "max-w-2xl" : "max-w-4xl";
  return (
    <div className={`mx-auto ${widthClass} ${spacingClassName} px-1 sm:px-0${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

