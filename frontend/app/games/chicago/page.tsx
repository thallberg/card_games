import { Suspense } from "react";
import { ChicagoClient } from "./ChicagoClient";

export default function ChicagoPage() {
  return (
    <main className="flex-1 p-4 sm:p-6">
      <Suspense fallback={<p className="text-muted-foreground">Laddar Chicago…</p>}>
        <ChicagoClient />
      </Suspense>
    </main>
  );
}
