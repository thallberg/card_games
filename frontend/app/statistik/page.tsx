"use client";

import { Suspense } from "react";
import Link from "next/link";
import { BarChart2 } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { LoadingPage } from "@/components/ui/loading-page";

function StatistikContent() {
  return (
    <main className="flex-1 p-3 sm:p-6">
      <section className="mx-auto max-w-4xl space-y-6">
        <header>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Statistik</h1>
          <p className="mt-2 text-muted-foreground text-sm sm:text-base">
            Översikt av dina spel och aktiviteter.
          </p>
        </header>

        <SectionCard variant="sky" icon={BarChart2} title="Statistik">
          <p className="text-muted-foreground text-sm">
            Här kommer mer statistik av olika slag: spelade partier, vinster, vänner och mer.
          </p>
          <p className="mt-2 text-muted-foreground text-sm">
            <Link href="/min-meny" className="underline underline-offset-4 hover:text-foreground">
              ← Tillbaka till Min profil
            </Link>
          </p>
        </SectionCard>
      </section>
    </main>
  );
}

export default function StatistikPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <StatistikContent />
    </Suspense>
  );
}
