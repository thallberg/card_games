import { Suspense } from "react";
import { TexasHoldemClient } from "./TexasHoldemClient";

export default function TexasHoldemPage() {
  return (
    <main className="flex-1 p-4 sm:p-6">
      <Suspense fallback={<p className="text-muted-foreground">Laddar Texas Hold&apos;em...</p>}>
        <TexasHoldemClient />
      </Suspense>
    </main>
  );
}
