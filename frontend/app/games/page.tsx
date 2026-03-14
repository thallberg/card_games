import Link from "next/link";
import { User, Users, Gamepad2 } from "lucide-react";
import { SectionCard } from "@/components/section-card";

const GAMES = [
  { id: "texasholdem", label: "Texas Hold'em", singleHref: "/games/texasholdem", multiHref: "/vanner?inviteGame=texasholdem", variant: "lavender" as const },
  { id: "fivehoundred", label: "500", singleHref: "/games/fivehoundred", multiHref: "/vanner?inviteGame=fivehoundred", variant: "mint" as const },
  { id: "chicago", label: "Chicago", singleHref: "/games/chicago", multiHref: "/vanner?inviteGame=chicago", variant: "peach" as const },
  { id: "skitgubbe", label: "Skitgubbe", singleHref: "/games/skitgubbe", multiHref: "/vanner?inviteGame=skitgubbe", variant: "sage" as const },
];

export default function GamesPage() {
  return (
    <main className="flex-1 p-3 sm:p-6">
      <section className="mx-auto max-w-4xl space-y-8">
        <header>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Kortspel</h1>
          <p className="mt-2 text-muted-foreground text-sm sm:text-base">
            Välj ett spel nedan eller från sidomenyn.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {GAMES.map((g) => (
            <SectionCard key={g.id} variant={g.variant} title={g.label}>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={g.singleHref}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-background/80 px-3 py-2 text-sm font-medium hover:bg-background transition-colors"
                >
                  <User className="size-4 shrink-0" aria-hidden />
                  Single player
                </Link>
                <Link
                  href={g.multiHref}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-background/80 px-3 py-2 text-sm font-medium hover:bg-background transition-colors"
                >
                  <Users className="size-4 shrink-0" aria-hidden />
                  Multiplayer
                </Link>
              </div>
            </SectionCard>
          ))}
        </section>
      </section>
    </main>
  );
}
