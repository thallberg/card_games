import { Suspense } from "react";
import { SkitgubbeClient } from "./SkitgubbeClient";

export default function SkitgubbePage() {
  return (
    <main className="flex-1 p-3 sm:p-6 min-h-0 overflow-auto">
      <Suspense fallback={<p className="text-muted-foreground">Laddar Skitgubbe…</p>}>
        <SkitgubbeClient />
      </Suspense>
    </main>
  );
}
