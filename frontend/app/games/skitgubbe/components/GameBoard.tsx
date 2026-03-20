"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useSkitgubbeGame } from "../hooks/useSkitgubbeGame";
import { useSkitgubbeGameMultiplayer } from "../hooks/useSkitgubbeGameMultiplayer";
import { PlayingCard } from "@/components/playing-card";
import { StockPile } from "./StockPile";
import { WonPile } from "./WonPile";
import { PlayerInfoCard } from "@/components/player-info-card";
import { Button } from "@/components/ui/button";
import { PlayerStatusRow } from "@/components/game/player-status-row";
import { GameResultPanel } from "@/components/game/game-result-panel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MIN_PLAYERS, MAX_PLAYERS } from "../constants";
import { MultiplayerStateGate } from "@/components/game/multiplayer-state-gate";
import { SinglePlayerIntro } from "@/components/single-player-intro";

const SUIT_LABELS: Record<string, string> = {
  hearts: "hjärter",
  diamonds: "ruter",
  clubs: "klöver",
  spades: "spader",
};

const RANK_LABELS: Record<string, string> = {
  "2": "2", "3": "3", "4": "4", "5": "5", "6": "6",
  "7": "7", "8": "8", "9": "9", "10": "10",
  jack: "knekt", queen: "dam", king: "kung", ace: "ess",
};

type GameBoardProps = { sessionId?: string };

export function GameBoard({ sessionId }: GameBoardProps) {
  const single = useSkitgubbeGame();
  const multi = useSkitgubbeGameMultiplayer(sessionId);
  const useMulti = !!sessionId;
  const [skitgubbeShowOnlySkitgubbe, setSkitgubbeShowOnlySkitgubbe] = useState(false);
  const [skitgubbeModalClosed, setSkitgubbeModalClosed] = useState(false);

  const {
    state,
    playerCount,
    humanHand,
    isHumanTurn,
    playableStickIndices,
    playableTrickIndices,
    selectedTrickIndices,
    isTrickSelectionValid,
    confirmTrickPlay,
    canDrawAndPlay,
    canPickUpTrick,
    startGame,
    playCardFromHand,
    drawAndPlay,
    continueToPlay,
    playTrickCard,
    pickUpTrick,
    resetGame,
    getPlayerIds,
    getSkitgubbePreview,
  } = useMulti ? multi : single;

  const myPlayerId = useMulti ? (multi.myPlayerId ?? "p1") : "p1";
  const loading = useMulti && multi.loading;
  const waitingForStart = useMulti && multi.waitingForStart;

  useEffect(() => {
    if (state?.phase !== "skitgubbe") return;
    setSkitgubbeShowOnlySkitgubbe(false);
    setSkitgubbeModalClosed(false);
  }, [state?.phase]);

  const multiplayerGate = MultiplayerStateGate({
    useMulti,
    loading,
    waitingForStart,
    hasState: !!state,
    onRetry: multi.loadState,
  });
  if (multiplayerGate) return multiplayerGate;

  if (playerCount === null && !useMulti) {
    return (
      <SinglePlayerIntro
        title="Skitgubbe – single player"
        description="Välj antal spelare (2–6). Du spelar som spelare 1, övriga är datorer."
        minPlayers={MIN_PLAYERS}
        maxPlayers={MAX_PLAYERS}
        onSelect={startGame}
      />
    );
  }

  if (!state) return null;

  const playerDisplayNames = useMulti ? multi.playerDisplayNames : undefined;
  const playerAvatarEmojis = useMulti ? multi.playerAvatarEmojis : undefined;
  const playerLabel = (id: string) => {
    if (id === myPlayerId) return playerDisplayNames?.[id] ? `${playerDisplayNames[id]} (Du)` : "Du";
    return playerDisplayNames?.[id] ?? "Spelare " + id;
  };

  if (state.phase === "skitgubbe") {
    const preview = getSkitgubbePreview?.() ?? null;
    const skitgubbeIds = preview?.skitgubbeIds ?? [];
    const threshold = preview?.threshold ?? 0;
    const isSecondView = skitgubbeShowOnlySkitgubbe;
    const playerIdsToShow =
      isSecondView && skitgubbeIds.length > 0 ? skitgubbeIds : state.playerIds;
    return (
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 px-1 sm:px-0">
        <Dialog open={!skitgubbeModalClosed}>
          <DialogContent showCloseButton={false} className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {!isSecondView
                  ? "Antal plockade kort"
                  : skitgubbeIds.length > 0
                    ? "Får skiten (under " + threshold + " kort)"
                    : "Ingen får skiten"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              {playerIdsToShow.length > 0 ? (
                playerIdsToShow.map((id) => {
                  const count = (state.wonCards?.[id] ?? []).length;
                  const getsSkit = skitgubbeIds.includes(id);
                  return (
                    <div
                      key={id}
                      className={`flex items-center gap-3 rounded-lg border p-3 ${
                        getsSkit && isSecondView
                          ? "border-amber-600 bg-amber-500/20"
                          : "border-border bg-muted/30"
                      }`}
                    >
                      <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded border border-border">
                        <Image
                          src="/cardback.png"
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {playerLabel(id)}
                          {playerAvatarEmojis?.[id] && " " + playerAvatarEmojis[id]}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {count} kort plockade
                          {getsSkit && isSecondView && " – får skiten"}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-muted-foreground text-sm py-2">
                  Alla plockade minst {threshold} kort.
                </p>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <Button
                variant="outlinePrimary"
                onClick={() => {
                  if (!isSecondView) setSkitgubbeShowOnlySkitgubbe(true);
                  else setSkitgubbeModalClosed(true);
                }}
              >
                Vidare
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <section className="rounded-lg border border-border bg-[var(--warm-peach)]/30 p-4">
          <div className="flex flex-col items-center gap-4">
            {state.lastRevealedCard ? (
              <>
                <p className="text-muted-foreground">
                  Sista kortet var {RANK_LABELS[state.lastRevealedCard.rank]}{" "}
                  {SUIT_LABELS[state.lastRevealedCard.suit]}. Trumf är{" "}
                  {SUIT_LABELS[state.trumpSuit ?? ""]}. Krav: minst {threshold} plockade kort.
                </p>
                <PlayingCard card={state.lastRevealedCard} faceUp />
              </>
            ) : (
              <p className="text-muted-foreground">
                Trumf: {state.trumpSuit ? SUIT_LABELS[state.trumpSuit] : "—"}
              </p>
            )}
            {skitgubbeIds.length > 0 ? (
              <div className="w-full rounded-lg border-2 border-amber-600 bg-amber-500/20 p-4 text-center">
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  {skitgubbeIds.length === 1
                    ? `${playerLabel(skitgubbeIds[0])}${playerAvatarEmojis?.[skitgubbeIds[0]] ? " " + playerAvatarEmojis[skitgubbeIds[0]] : ""} fick skitgubbe`
                    : skitgubbeIds.map((id) => playerLabel(id)).join(", ") + " delar skiten"}
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  Färre än {threshold} plockade kort – får 2, 3, 4, 5 (alla färger) och trumf 6.
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Ingen blev skitgubbe – alla plockade minst {threshold} kort.
              </p>
            )}
            <Button variant="outlinePrimary" onClick={continueToPlay}>Fortsätt till utspelet</Button>
          </div>
        </section>
      </div>
    );
  }

  if (state.phase === "gameOver") {
    return (
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 px-1 sm:px-0">
        <GameResultPanel
          message={state.winnerId ? playerLabel(state.winnerId) + (playerAvatarEmojis?.[state.winnerId] ? " " + playerAvatarEmojis[state.winnerId] : "") + " vann!" : ""}
          className="rounded-lg border border-[var(--border)] bg-[var(--warm-peach)]/50 p-6 text-center"
          actions={[{ label: "Spela igen", onClick: resetGame, variant: "outlinePrimary", className: "mt-2" }]}
        />
      </div>
    );
  }

  const isSticks = state.phase === "sticks";
  const playableIndices = isSticks ? playableStickIndices : playableTrickIndices;

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 px-1 sm:px-0">
      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
        <PlayerStatusRow
          playerIds={getPlayerIds()}
          currentPlayerId={state.currentPlayerId}
          className="flex flex-wrap justify-center gap-4 sm:gap-6 text-xs sm:text-sm"
          renderPlayer={(id, { isActive }) => (
            <PlayerInfoCard
              key={id}
              isActive={isActive}
              name={playerLabel(id)}
              rightAdornment={playerAvatarEmojis?.[id]}
              subtitle={isSticks ? `Stick: ${state.sticksWon[id] ?? 0}` : `${state.playerHands[id]?.length ?? 0} kort`}
            />
          )}
        />
      </div>

      {state.phase === "sticks" && state.trumpSuit && (
        <div className="flex flex-wrap items-center gap-2">
          {state.lastRevealedCard ? (
            <>
              <p className="text-muted-foreground text-sm">
                Trumf: {SUIT_LABELS[state.lastRevealedCard.suit]} ({state.lastRevealedCard.rank})
              </p>
              <PlayingCard card={state.lastRevealedCard} faceUp />
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Trumf: {SUIT_LABELS[state.trumpSuit]}
            </p>
          )}
        </div>
      )}
      {state.phase === "play" && state.trumpSuit && (
        <p className="text-muted-foreground text-sm">
          Trumf: {SUIT_LABELS[state.trumpSuit]}
        </p>
      )}

      {isSticks && (
        <>
          <div className="flex flex-wrap items-end justify-center gap-4 sm:gap-6">
            <StockPile
              count={state.stock.length}
              onDraw={canDrawAndPlay ? drawAndPlay : undefined}
              disabled={!canDrawAndPlay}
              isMyTurn={isHumanTurn}
            />
            {getPlayerIds().map((id) => (
              <WonPile
                key={id}
                count={(state.wonCards ?? {})[id]?.length ?? 0}
                label={id === myPlayerId ? "Mina kort" : playerLabel(id) + (playerAvatarEmojis?.[id] ? " " + playerAvatarEmojis[id] : "")}
              />
            ))}
          </div>
          <section className="rounded-lg border border-[var(--border)] bg-[var(--warm-sand)]/40 p-3 sm:p-4">
            <h2 className="mb-2 text-sm font-medium">Fas 1 – Stick</h2>
          {state.stickFighters.length > 0 && state.stickLedRank && (
            <div className="mb-3 rounded-md border-2 border-amber-500 bg-amber-500/15 px-3 py-2 text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Fight – samma valör ({RANK_LABELS[state.stickLedRank] ?? state.stickLedRank}) lades ut.
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Det står mellan: {state.stickFighters.map((f) => playerLabel(f) + (playerAvatarEmojis?.[f] ? " " + playerAvatarEmojis[f] : "")).join(" och ")}. Nästa kort avgör.
              </p>
            </div>
          )}
          <div className="mb-4 min-h-[152px]">
            <div className="min-h-[120px]">
            {state.tableStick.length > 0 && (
              <div className="flex flex-wrap items-end gap-2">
                {state.tableStick.map((sc, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <PlayingCard card={sc.card} faceUp />
                    <span className="text-xs text-muted-foreground">
                      {playerLabel(sc.playerId)}{playerAvatarEmojis?.[sc.playerId] && " " + playerAvatarEmojis[sc.playerId]}
                    </span>
                  </div>
                ))}
              </div>
            )}
            </div>
            {state.stickShowingWinner ? (
              <p className="text-sm font-medium text-primary mb-0 min-h-[1.5rem]">
                {playerLabel(state.stickShowingWinner)}{playerAvatarEmojis?.[state.stickShowingWinner] && " " + playerAvatarEmojis[state.stickShowingWinner]} vann sticket!
              </p>
            ) : !isHumanTurn ? (
              <p className="text-muted-foreground text-sm min-h-[1.5rem]">Andra spelares tur…</p>
            ) : (
              <p className="text-sm min-h-[1.5rem] invisible" aria-hidden>placeholder</p>
            )}
          </div>
          </section>
        </>
      )}

      {state.phase === "play" && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--warm-sand)]/40 p-3 sm:p-4">
          <h2 className="mb-2 text-sm font-medium">Fas 2 – Utspelet</h2>
          {state.trumpSuit && (
            <p className="text-muted-foreground text-xs mb-2">Trumf: {SUIT_LABELS[state.trumpSuit]}</p>
          )}
          <div className="mb-4 min-h-[152px]">
            <div className="min-h-[120px]">
            {(state.tableTrick.length > 0 || state.trickShowingWinner) && (
              <div className="flex flex-wrap items-end gap-2">
                {state.tableTrick.map((tc, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <PlayingCard card={tc.card} faceUp />
                    <span className="text-xs text-muted-foreground">
                      {playerLabel(tc.playerId)}{playerAvatarEmojis?.[tc.playerId] && " " + playerAvatarEmojis[tc.playerId]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
            {state.trickPickUpBy ? (
              <p className="text-sm font-medium text-primary mb-0 min-h-[1.5rem]">
                {playerLabel(state.trickPickUpBy)}{playerAvatarEmojis?.[state.trickPickUpBy] && " " + playerAvatarEmojis[state.trickPickUpBy]} plockade sticket
              </p>
            ) : !isHumanTurn && !state.trickShowingWinner ? (
              <p className="text-muted-foreground text-sm min-h-[1.5rem]">Andra spelares tur…</p>
            ) : (
              <p className="text-sm min-h-[1.5rem] invisible" aria-hidden>placeholder</p>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Din hand
          {isHumanTurn &&
            !isSticks &&
            " – markera kort (enkort eller stege), klicka Lägg ut för att spela"}
        </h2>
        <div
          className={
            state.phase === "play"
              ? "flex flex-wrap gap-2 overflow-x-auto overflow-y-visible pb-2 min-h-[90px]"
              : "flex flex-wrap gap-2"
          }
        >
          {humanHand.map((card, i) => {
            const canPlay = playableIndices.has(i);
            const isPlayPhase = state.phase === "play";
            const isSelected = isPlayPhase && selectedTrickIndices?.has(i);
            const onClick =
              isSticks
                ? isHumanTurn && canPlay
                  ? () => playCardFromHand(i)
                  : undefined
                : isHumanTurn && !state.trickShowingWinner
                  ? () => playTrickCard(i)
                  : undefined;
            const dimmed =
              isSticks && isHumanTurn && !canPlay
                ? true
                : isPlayPhase && isHumanTurn
                  ? false
                  : isHumanTurn && !canPlay;
            return (
              <PlayingCard
                key={`${card.suit}-${card.rank}-${i}`}
                card={card}
                faceUp
                dimmed={dimmed}
                selected={isSelected}
                onClick={onClick}
              />
            );
          })}
        </div>
        {state.phase === "play" && isHumanTurn && isTrickSelectionValid && (
          <Button variant="outlinePrimary" onClick={confirmTrickPlay} className="mt-3">
            Lägg ut
          </Button>
        )}
        {state.phase === "play" && isHumanTurn && canPickUpTrick && (
          <Button variant="outline" onClick={pickUpTrick} className="mt-3">
            Plocka sticket
          </Button>
        )}
      </section>

    </div>
  );
}
