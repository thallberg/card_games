import { Spinner } from "@/components/ui/spinner";

/** Centrerad loading-cirkel för sidor och sektioner */
export function LoadingPage({ className }: { className?: string }) {
  return (
    <div
      className={`flex min-h-[200px] flex-1 items-center justify-center p-4 sm:p-6 ${className ?? ""}`}
      role="status"
      aria-label="Laddar"
    >
      <Spinner size="lg" />
    </div>
  );
}
