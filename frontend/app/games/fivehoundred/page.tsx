import { Suspense } from "react";
import { LoadingPage } from "@/components/ui/loading-page";
import { FiveHoundredClient } from "./FiveHoundredClient";

export default function FiveHoundredPage() {
  return (
    <main className="flex-1 p-3 sm:p-6 min-h-0 overflow-auto">
      <Suspense fallback={<LoadingPage className="min-h-0" />}>
        <FiveHoundredClient />
      </Suspense>
    </main>
  );
}
