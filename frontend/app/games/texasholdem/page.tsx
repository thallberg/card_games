import { Suspense } from "react";
import { LoadingPage } from "@/components/ui/loading-page";
import { TexasHoldemClient } from "./TexasHoldemClient";

export default function TexasHoldemPage() {
  return (
    <main className="flex-1 p-2 sm:p-4 min-h-0 overflow-auto">
      <Suspense fallback={<LoadingPage className="min-h-0" />}>
        <TexasHoldemClient />
      </Suspense>
    </main>
  );
}
