import { Suspense } from "react";
import { FiveHoundredClient } from "./FiveHoundredClient";

export default function FiveHoundredPage() {
  return (
    <main className="flex-1 p-4 sm:p-6">
      <Suspense fallback={<p className="text-muted-foreground">Laddar 500...</p>}>
        <FiveHoundredClient />
      </Suspense>
    </main>
  );
}
