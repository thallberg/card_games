export default function Home() {
  return (
    <main className="flex-1 p-3 sm:p-6">
      <section className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-semibold">Spela kortspel – själv eller med vänner</h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
            Kortspel samlar klassiska kortspel på ett ställe. Spela själv mot datorn eller starta onlinespel
            tillsammans med dina vänner – direkt i webbläsaren, utan nedladdningar.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-lg border bg-card p-4 shadow-sm space-y-2">
            <h2 className="text-base sm:text-lg font-semibold">Single player mot datorn</h2>
            <p className="text-sm text-muted-foreground">
              Testa regler, träna taktik eller spela en snabb omgång själv. Välj spel i sidomenyn under
              <span className="font-semibold"> Single player</span> och spela mot datorstyrda motståndare.
            </p>
          </article>

          <article className="rounded-lg border bg-card p-4 shadow-sm space-y-2">
            <h2 className="text-base sm:text-lg font-semibold">Multiplayer med vänner</h2>
            <p className="text-sm text-muted-foreground">
              Skapa en spelomgång och bjud in dina vänner. Via sidan
              <span className="font-semibold"> Mina vänner</span> kan du hålla koll på vänförfrågningar och bjuda in
              flera till samma spel.
            </p>
          </article>

          <article className="rounded-lg border bg-card p-4 shadow-sm space-y-2">
            <h2 className="text-base sm:text-lg font-semibold">Mina spel</h2>
            <p className="text-sm text-muted-foreground">
              Under <span className="font-semibold">Mina spel</span> ser du alla pågående partier, väntande inbjudningar
              och kan hoppa direkt in i nästa giv. Där startar du även spel tillsammans med vänner.
            </p>
          </article>

          <article className="rounded-lg border bg-card p-4 shadow-sm space-y-2">
            <h2 className="text-base sm:text-lg font-semibold">Din profil & avatar</h2>
            <p className="text-sm text-muted-foreground">
              På sidan <span className="font-semibold">Min meny</span> kan du byta visningsnamn, välja en emoji-avatar
              eller ladda upp en egen bild. Din avatar visas i sidomenyn och i spelet när du spelar mot andra.
            </p>
          </article>
        </section>

        <section className="space-y-2">
          <h2 className="text-base sm:text-lg font-semibold">Så kommer du igång</h2>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
            <li>Registrera ett konto eller logga in via knapparna i sidomenyn.</li>
            <li>Lägg till vänner genom sidan &quot;Bjud in vän&quot;.</li>
            <li>Gå till &quot;Mina spel&quot; för att starta ett nytt spel och bjuda in dina vänner.</li>
            <li>Välj Single player om du vill spela själv mot datorn.</li>
          </ol>
        </section>
      </section>
    </main>
  );
}
