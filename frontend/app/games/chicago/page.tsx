import { Suspense } from "react";
import { LoadingPage } from "@/components/ui/loading-page";
import { ChicagoClient } from "./ChicagoClient";

export default function ChicagoPage() {
  return (
    <main className="flex-1 p-3 sm:p-6 min-h-0 overflow-auto">
      <Suspense fallback={<LoadingPage className="min-h-0" />}>
        <ChicagoClient />
      </Suspense>
    </main>
  );
}
