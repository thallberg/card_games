import { Suspense } from "react";
import { GameBoard } from "./components";

export default function ChicagoPage() {
  return (
    <main className="flex-1 p-4 sm:p-6">
      <Suspense fallback={<p className="text-muted-foreground">Laddar Chicago…</p>}>
        <GameBoard />
      </Suspense>
    </main>
  );
}
