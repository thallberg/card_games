import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

function Spinner({
  className,
  size = "default",
  ...props
}: Omit<React.ComponentProps<typeof Loader2>, "size"> & {
  size?: "sm" | "default" | "lg";
}) {
  const sizeClasses = {
    sm: "size-4",
    default: "size-6",
    lg: "size-8",
  };
  return (
    <Loader2
      role="status"
      aria-label="Laddar"
      className={cn("animate-spin text-muted-foreground", sizeClasses[size], className)}
      {...props}
    />
  );
}

export { Spinner };
