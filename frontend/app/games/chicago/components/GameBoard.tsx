"use client";

import { useChicagoGame } from "../hooks/useChicagoGame";
import { useChicagoGameMultiplayer } from "../hooks/useChicagoGameMultiplayer";
import { getNextPlayerId } from "../game-state";
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

type GameBoardProps = { sessionId?: string };

export function GameBoard({ sessionId }: GameBoardProps) {
  const single = useChicagoGame();
  const multi = useChicagoGameMultiplayer(sessionId);
  const useMulti = !!sessionId;
  const myPlayerId = useMulti ? multi.myPlayerId : "p1";
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
  } = useMulti ? multi : single;

  if (!state) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground">{useMulti && !multi.isReady ? "Laddar Chicago..." : "Laddar Chicago..."}</p>
      </div>
    );
  }

  const isMyTurnPlay =
    state.phase === "play" &&
    (state.trickCards === null
      ? state.trickLeader === myPlayerId
      : getNextPlayerId(state.trickLeader) === myPlayerId);

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 px-1 sm:px-0">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        <h1 className="text-lg sm:text-xl font-semibold">Poker Chicago</h1>
        <div className="flex gap-4 sm:gap-6 text-xs sm:text-sm">
          {getPlayerIds().map((id) => (
            <div key={id} className="flex flex-col gap-0.5">
              <span className="font-medium">{id === myPlayerId ? "Du" : "Motståndare"}</span>
              <span className="text-muted-foreground">
                Poäng: {state.playerScores[id] ?? 0}
              </span>
              {id !== myPlayerId && state.phase !== "roundEnd" && state.phase !== "gameOver" && (
                <span className="text-muted-foreground text-xs">
                  {state.playerHands[id]?.length ?? 0} kort
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {state.phase === "draw" && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--warm-peach)]/30 p-3 sm:p-4">
          {state.currentPlayerId === (useMulti ? (myPlayerId === "p1" ? "p2" : "p1") : "p2") ? (
            <p className="text-muted-foreground text-center">
              Omgång {state.drawRound + 1} av 3 – motståndaren kastar kort…
            </p>
          ) : state.drawPick ? (
            <div className="space-y-4">
              <h2 className="text-sm font-medium">
                Välj ett kort (plock {state.drawPick.tempHand.length + 1} av {state.drawPick.tempHand.length + 1 + state.drawPick.picksLeft})
              </h2>
              <p className="text-muted-foreground text-xs">
                Du får ett öppet kort och ett dolt kort – välj vilket du vill ta.
              </p>
              <div className="flex flex-wrap items-end justify-center gap-4 sm:gap-6">
                <div className="flex flex-col items-center gap-2 min-w-0">
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
          ) : (
            <>
              <h2 className="mb-2 text-sm font-medium text-center">
                Omgång {state.drawRound + 1} av {3} – välj kort att kasta
              </h2>
              {state.drawRound === 0 && (
                <p className="text-muted-foreground mb-3 text-xs text-center">
                  Markera kort att kasta. Kastar du <strong>ett</strong> kort får du välja mellan ett öppet och ett dolt kort; kastar du fler får du lika många nya från leken. 3 omgångar (du och motståndaren turvis). Klicka &quot;Nöjd&quot; om du inte vill kasta.
                </p>
              )}
              {typeof state.lastOpponentDiscardCount === "number" && (
                <p className="text-muted-foreground text-xs mb-3 text-center">
                  Motståndaren kastade {state.lastOpponentDiscardCount} kort
                </p>
              )}
              <div className="flex flex-wrap justify-center gap-2">
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
              <div className="mt-3 flex flex-col sm:flex-row flex-wrap gap-2">
                {canFreeSwapAllFive && (
                  <Button variant="secondary" onClick={freeSwapAllFive} className="min-h-11 w-full sm:w-auto">
                    Byt alla 5 (gratis, endast omgång 1, max {3 - (state.freeSwapUsedCount ?? 0)} kvar)
                  </Button>
                )}
                <Button
                  onClick={confirmDiscard}
                  disabled={!canConfirmDiscard}
                  className="min-h-11 w-full sm:w-auto"
                >
                  Kasta {selectedToDiscard.size} kort och plocka nya
                </Button>
                <Button variant="outline" onClick={doneWithDraw} className="min-h-11 w-full sm:w-auto">
                  Nöjd
                </Button>
              </div>
            </>
          )}
        </section>
      )}

      {state.phase === "play" && (
        <>
          <section className="rounded-lg border border-[var(--border)] bg-[var(--warm-sand)]/40 p-3 sm:p-4">
            <h2 className="mb-2 text-sm font-medium">Stick {state.trickNumber + 1} av 5</h2>

            {state.completedTricks && state.completedTricks.length > 0 && (
              <div className="mb-4 space-y-3 overflow-x-auto">
                <span className="text-muted-foreground text-xs font-medium block">Tidigare stick:</span>
                {state.completedTricks.map((t, i) => {
                  const oppCard = t.trickLeader === myPlayerId ? t.followerCard : t.leaderCard;
                  const myCard = t.trickLeader === myPlayerId ? t.leaderCard : t.followerCard;
                  return (
                    <div key={i}>
                      {i > 0 && <hr className="my-3 border-muted-foreground/20" />}
                      <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm">
                        <span className="text-muted-foreground">Stick {i + 1}:</span>
                        <span className="flex items-center gap-1">
                          Motståndaren: <PlayingCard card={oppCard} faceUp />
                        </span>
                        <span className="flex items-center gap-1">
                          Du: <PlayingCard card={myCard} faceUp />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {state.trickCards && (
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <span className="text-muted-foreground text-xs">
                    {state.trickLeader === myPlayerId ? "Du" : "Motståndaren"} lade:
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
        const otherId = myPlayerId === "p1" ? "p2" : "p1";
        const myHandPoints = state.roundHandPoints?.[myPlayerId] ?? 0;
        const oppHandPoints = state.roundHandPoints?.[otherId] ?? 0;
        const humanWonHand = myHandPoints > oppHandPoints;
        const opponentWonHand = oppHandPoints > myHandPoints;
        const myHand = state.playPhaseHands?.[myPlayerId] ?? [];
        const oppHand = state.playPhaseHands?.[otherId] ?? [];
        return (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--warm-peach)]/50 p-4 sm:p-6">
          <p className="text-center font-medium">
            {state.roundUtspeletWinner === myPlayerId ? "Du" : "Motståndaren"} vann utspelet (sista sticket)! +1 poäng
          </p>
          <p className="text-center text-muted-foreground text-sm mt-1">
            Båda får poäng för sin hand.
          </p>
          <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 sm:grid-cols-2">
            <div className="rounded-md border-2 border-[var(--warm-sage)]/60 bg-[var(--warm-sage)]/15 p-3 sm:p-4">
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">Din hand</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                {getHandDescription(myHand)}
                {humanWonHand ? ` — högre hand (+${myHandPoints} p)` : opponentWonHand ? ` — lägre hand (+${myHandPoints} p)` : ` — lika (+${myHandPoints} p)`}
              </p>
              <div className="flex flex-wrap justify-center gap-1">
                {myHand.map((card, i) => (
                  <PlayingCard
                    key={`me-${card.suit}-${card.rank}-${i}`}
                    card={card}
                    faceUp
                    highlight={getHandHighlightIndices(myHand).has(i)}
                  />
                ))}
              </div>
            </div>
            <div className="rounded-md border-2 border-[var(--warm-gold)]/50 bg-[var(--warm-gold)]/15 p-3 sm:p-4">
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">Motståndarens hand</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                {getHandDescription(oppHand)}
                {opponentWonHand ? ` — högre hand (+${oppHandPoints} p)` : humanWonHand ? ` — lägre hand (+${oppHandPoints} p)` : ` — lika (+${oppHandPoints} p)`}
              </p>
              <div className="flex flex-wrap justify-center gap-1">
                {oppHand.map((card, i) => (
                  <PlayingCard
                    key={`opp-${card.suit}-${card.rank}-${i}`}
                    card={card}
                    faceUp
                    highlight={getHandHighlightIndices(oppHand).has(i)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-center gap-2">
            <Button onClick={startNewRound} className="min-h-11 w-full sm:w-auto">Nästa rond</Button>
            {!useMulti && (
              <Button variant="outline" onClick={resetGame} className="min-h-11 w-full sm:w-auto">Börja om</Button>
            )}
          </div>
        </div>
        );
      })()}

      {state.phase === "gameOver" && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--warm-peach)]/50 p-6 text-center">
          <p className="font-medium">Spelet är slut.</p>
          {!useMulti && (
            <Button onClick={resetGame} className="mt-2">Spela igen</Button>
          )}
        </div>
      )}
    </div>
  );
}
