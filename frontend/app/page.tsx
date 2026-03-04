import { games } from "@/data-content/games";
import { GameCard } from "@/components/game-card";

export default function Home() {
  return (
    <main className="flex-1 p-3 sm:p-6">
      <section className="mx-auto max-w-5xl">
        <h2 className="mb-4 text-base sm:text-lg font-semibold">Välj kortspel</h2>
        <ul className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
          {games.map((game) => (
            <li key={game.id}>
              <GameCard game={game} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
