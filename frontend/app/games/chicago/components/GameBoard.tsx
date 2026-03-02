"use client";

import { useChicagoGame } from "../hooks/useChicagoGame";
import { getHandHighlightIndices } from "../hand-score";
import { PlayingCard } from "./PlayingCard";
import { Button } from "@/components/ui/button";

const RANK_LABELS: Record<string, string> = {
  "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8",
  "9": "9", "10": "10", jack: "Knekt", queen: "Dam", king: "Kung", ace: "Ess",
};
const SUIT_LABELS: Record<string, string> = {
  hearts: "hjärter", diamonds: "ruter", clubs: "klöver", spades: "spader",
};

export function GameBoard() {
  const {
    state,
    humanHand,
    playableCardIndices,
    selectedToDiscard,
    toggleDiscardSelection,
    confirmDiscard,
    chooseDrawnCard,
    freeSwapAllFive,
    doneWithDraw,
    playCard,
    startNewRound,
    resetGame,
    getPlayerIds,
    getHandDescription,
    canConfirmDiscard,
    canFreeSwapAllFive,
  } = useChicagoGame();

  if (!state) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground">Laddar Chicago...</p>
      </div>
    );
  }

  const isMyTurnPlay =
    state.phase === "play" &&
    (state.trickCards === null
      ? state.trickLeader === "p1"
      : state.trickLeader === "p2");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Poker Chicago</h1>
        <div className="flex gap-6 text-sm">
          {getPlayerIds().map((id) => (
            <div key={id} className="flex flex-col gap-0.5">
              <span className="font-medium">{id === "p1" ? "Du" : "Motståndare"}</span>
              <span className="text-muted-foreground">
                Poäng: {state.playerScores[id] ?? 0}
              </span>
              {id === "p2" && state.phase !== "roundEnd" && state.phase !== "gameOver" && (
                <span className="text-muted-foreground text-xs">
                  {state.playerHands[id]?.length ?? 0} kort
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {state.phase === "draw" && (
        <section className="rounded-lg border bg-muted/30 p-4">
          {state.drawPick ? (
            <div className="space-y-4">
              <h2 className="text-sm font-medium">
                Välj ett kort (plock {state.drawPick.tempHand.length + 1} av {state.drawPick.tempHand.length + 1 + state.drawPick.picksLeft})
              </h2>
              <p className="text-muted-foreground text-xs">
                Du får ett öppet kort och ett dolt kort – välj vilket du vill ta.
              </p>
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-muted-foreground text-xs">Öppet kort</span>
                  <PlayingCard card={state.drawPick.openCard} faceUp onClick={() => chooseDrawnCard("open")} />
                  <Button size="sm" onClick={() => chooseDrawnCard("open")}>
                    Ta öppet kort
                  </Button>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-muted-foreground text-xs">Dolt kort</span>
                  <PlayingCard card={state.drawPick.hiddenCard} faceUp={false} />
                  <Button size="sm" variant="outline" onClick={() => chooseDrawnCard("hidden")}>
                    Ta dolt kort
                  </Button>
                </div>
              </div>
            </div>
          ) : state.currentPlayerId === "p2" ? (
            <p className="text-muted-foreground">
              Omgång {state.drawRound + 1} av 3 – motståndaren kastar kort…
            </p>
          ) : (
            <>
              <h2 className="mb-2 text-sm font-medium">
                Omgång {state.drawRound + 1} av {3} – välj kort att kasta
              </h2>
              <p className="text-muted-foreground mb-3 text-xs">
                Markera kort att kasta. Kastar du <strong>ett</strong> kort får du välja mellan ett öppet och ett dolt kort; kastar du fler får du lika många nya från leken. 3 omgångar (du och motståndaren turvis). Klicka &quot;Färdig&quot; om du inte vill kasta.
              </p>
              <div className="flex flex-wrap gap-2">
                {humanHand.map((card, i) => (
                  <PlayingCard
                    key={`${card.suit}-${card.rank}-${i}`}
                    card={card}
                    faceUp
                    selected={selectedToDiscard.has(i)}
                    onClick={() => toggleDiscardSelection(i)}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {canFreeSwapAllFive && (
                  <Button variant="secondary" onClick={freeSwapAllFive}>
                    Byt alla 5 (gratis, endast omgång 1, max {3 - (state.freeSwapUsedCount ?? 0)} kvar)
                  </Button>
                )}
                <Button
                  onClick={confirmDiscard}
                  disabled={!canConfirmDiscard}
                >
                  Kasta {selectedToDiscard.size} kort och plocka nya
                </Button>
                {state.drawRound > 0 && (
                  <Button variant="outline" onClick={doneWithDraw}>
                    Färdig – gå till utspelet
                  </Button>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {state.phase === "play" && (
        <>
          <section className="rounded-lg border bg-muted/20 p-4">
            <h2 className="mb-2 text-sm font-medium">Stick {state.trickNumber + 1} av 5</h2>

            {state.completedTricks && state.completedTricks.length > 0 && (
              <div className="mb-4 space-y-2 border-b border-muted-foreground/20 pb-4">
                <span className="text-muted-foreground text-xs font-medium">Tidigare stick:</span>
                {state.completedTricks.map((t, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground whitespace-nowrap">Stick {i + 1}:</span>
                    <span className="text-muted-foreground text-xs">
                      {t.trickLeader === "p1" ? "Du" : "Motståndaren"} lade
                    </span>
                    <PlayingCard card={t.leaderCard} faceUp />
                    <span className="text-muted-foreground text-xs">
                      {t.trickLeader === "p2" ? "Du" : "Motståndaren"} lade
                    </span>
                    <PlayingCard card={t.followerCard} faceUp />
                    <span className="text-muted-foreground text-xs">
                      → {t.winner === "p1" ? "Du" : "Motståndaren"} vann
                    </span>
                  </div>
                ))}
              </div>
            )}

            {state.trickCards && (
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <span className="text-muted-foreground text-xs">
                    {state.trickLeader === "p1" ? "Du" : "Motståndaren"} lade:
                  </span>
                  <div className="mt-1 flex gap-1">
                    <PlayingCard card={state.trickCards[0]} faceUp />
                    {state.trickCards[1] && (
                      <PlayingCard card={state.trickCards[1]} faceUp />
                    )}
                  </div>
                </div>
              </div>
            )}
            {!state.trickCards && !isMyTurnPlay && (
              <p className="text-muted-foreground text-sm">
                Motståndarens tur att lägga första kortet…
              </p>
            )}
            {state.trickCards && !isMyTurnPlay && (
              <p className="text-muted-foreground mt-2 text-sm">
                Motståndarens tur att lägga kort…
              </p>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
              Din hand {isMyTurnPlay && "– välj ett kort att lägga (du måste följa färg om du kan)"}
            </h2>
            <div className="flex flex-wrap gap-2">
              {humanHand.map((card, i) => {
                const canPlay = isMyTurnPlay && playableCardIndices.has(i);
                return (
                  <PlayingCard
                    key={`${card.suit}-${card.rank}-${i}`}
                    card={card}
                    faceUp
                    selected={false}
                    dimmed={isMyTurnPlay && !canPlay}
                    onClick={canPlay ? () => playCard(i) : undefined}
                  />
                );
              })}
            </div>
          </section>
        </>
      )}

      {state.phase === "roundEnd" && (() => {
        const p1Hand = state.roundHandPoints?.p1 ?? 0;
        const p2Hand = state.roundHandPoints?.p2 ?? 0;
        const humanWonHand = p1Hand > p2Hand;
        const opponentWonHand = p2Hand > p1Hand;
        return (
        <div className="rounded-lg border bg-muted/50 p-6">
          <p className="text-center font-medium">
            {state.roundUtspeletWinner === "p1" ? "Du" : "Motståndaren"} vann utspelet (sista sticket)! +1 poäng
          </p>
          <p className="text-center text-muted-foreground text-sm mt-1">
            Endast den med högst hand får handpoäng.
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-md border-2 border-green-600/50 bg-green-500/5 p-4">
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">Din hand</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                {getHandDescription(state.playPhaseHands?.p1 ?? [])}
                {humanWonHand ? ` — vann handen (+${p1Hand} p)` : opponentWonHand ? " — lägre hand (0 p)" : " — lika (0 p)"}
              </p>
              <div className="flex flex-wrap gap-1">
                {(state.playPhaseHands?.p1 ?? []).map((card, i) => (
                  <PlayingCard
                    key={`p1-${card.suit}-${card.rank}-${i}`}
                    card={card}
                    faceUp
                    highlight={getHandHighlightIndices(state.playPhaseHands?.p1 ?? []).has(i)}
                  />
                ))}
              </div>
            </div>
            <div className="rounded-md border-2 border-amber-600/40 bg-amber-500/5 p-4">
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">Motståndarens hand</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                {getHandDescription(state.playPhaseHands?.p2 ?? [])}
                {opponentWonHand ? ` — vann handen (+${p2Hand} p)` : humanWonHand ? " — lägre hand (0 p)" : " — lika (0 p)"}
              </p>
              <div className="flex flex-wrap gap-1">
                {(state.playPhaseHands?.p2 ?? []).map((card, i) => (
                  <PlayingCard
                    key={`p2-${card.suit}-${card.rank}-${i}`}
                    card={card}
                    faceUp
                    highlight={getHandHighlightIndices(state.playPhaseHands?.p2 ?? []).has(i)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={startNewRound}>Nästa rond</Button>
            <Button variant="outline" onClick={resetGame}>
              Börja om
            </Button>
          </div>
        </div>
        );
      })()}

      {state.phase === "gameOver" && (
        <div className="rounded-lg border bg-muted/50 p-6 text-center">
          <p className="font-medium">Spelet är slut.</p>
          <Button onClick={resetGame} className="mt-2">Spela igen</Button>
        </div>
      )}
    </div>
  );
}
