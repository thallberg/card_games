import Link from "next/link";
import { User, Users, Gamepad2, UserCircle, Rocket } from "lucide-react";

export default function Home() {
  const cards = [
    {
      title: "Single player mot datorn",
      desc: "Testa regler, träna taktik eller spela en snabb omgång själv. Välj spel i sidomenyn under Single player och spela mot datorstyrda motståndare.",
      highlight: "Single player",
      highlightHref: "/games",
      color: "bg-[var(--pastel-lavender)] border-[var(--pastel-lavender)]/50",
      accent: "border-l-4 border-l-[var(--accent-lavender)]",
      icon: User,
    },
    {
      title: "Multiplayer med vänner",
      desc: "Skapa en spelomgång och bjud in dina vänner. Via sidan Mina vänner kan du hålla koll på vänförfrågningar och bjuda in flera till samma spel.",
      highlight: "Mina vänner",
      highlightHref: "/vanner",
      color: "bg-[var(--pastel-mint)] border-[var(--pastel-mint)]/50",
      accent: "border-l-4 border-l-[var(--accent-mint)]",
      icon: Users,
    },
    {
      title: "Mina spel",
      desc: "Under Mina spel ser du alla pågående partier, väntande inbjudningar och kan hoppa direkt in i nästa giv. Där startar du även spel tillsammans med vänner.",
      highlight: "Mina spel",
      highlightHref: "/spel",
      color: "bg-[var(--pastel-peach)] border-[var(--pastel-peach)]/50",
      accent: "border-l-4 border-l-[var(--accent-peach)]",
      icon: Gamepad2,
    },
    {
      title: "Din profil & avatar",
      desc: "På sidan Min meny kan du byta visningsnamn, välja en emoji-avatar eller ladda upp en egen bild. Din avatar visas i sidomenyn och i spelet när du spelar mot andra.",
      highlight: "Min meny",
      highlightHref: "/min-meny",
      color: "bg-[var(--pastel-sage)] border-[var(--pastel-sage)]/50",
      accent: "border-l-4 border-l-[var(--accent-sage)]",
      icon: UserCircle,
    },
  ];

  return (
    <main className="flex-1 p-3 sm:p-6">
      <section className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
            Spela kortspel – själv eller med vänner
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
            Kortspel samlar klassiska kortspel på ett ställe. Spela själv mot datorn eller starta onlinespel
            tillsammans med dina vänner – direkt i webbläsaren, utan nedladdningar.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
            <article
              key={c.title}
              className={`rounded-xl border p-5 shadow-sm space-y-2 transition-shadow hover:shadow-md ${c.color} ${c.accent}`}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-foreground/10">
                  <Icon className="size-5 text-foreground" aria-hidden />
                </div>
                <h2 className="text-base sm:text-lg font-semibold text-foreground">{c.title}</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {c.desc.split(c.highlight)[0]}
                <Link href={c.highlightHref} className="font-semibold text-foreground/90 underline underline-offset-2 hover:text-foreground">
                  {c.highlight}
                </Link>
                {c.desc.split(c.highlight)[1]}
              </p>
            </article>
          );
          })}
        </section>

        <section className="rounded-xl bg-[var(--pastel-sky)]/60 p-5 border-l-4 border-l-[var(--accent-sky)] space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-foreground/10">
              <Rocket className="size-5 text-foreground" aria-hidden />
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-foreground">Så kommer du igång</h2>
          </div>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/registrera" className="underline underline-offset-2 hover:text-foreground">Registrera</Link>
              {" "}ett konto eller{" "}
              <Link href="/logga-in" className="underline underline-offset-2 hover:text-foreground">logga in</Link>
              {" "}via knapparna i sidomenyn.
            </li>
            <li>Lägg till vänner genom sidan{" "}
              <Link href="/vaninbjudan" className="underline underline-offset-2 hover:text-foreground">&quot;Bjud in vän&quot;</Link>.
            </li>
            <li>Gå till{" "}
              <Link href="/spel" className="underline underline-offset-2 hover:text-foreground">&quot;Mina spel&quot;</Link>
              {" "}för att starta ett nytt spel och bjuda in dina vänner.</li>
            <li>Välj{" "}
              <Link href="/games" className="underline underline-offset-2 hover:text-foreground">Single player</Link>
              {" "}om du vill spela själv mot datorn.</li>
          </ol>
        </section>
      </section>
    </main>
  );
}
