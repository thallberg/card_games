"use client";

import Link from "next/link";
import { SinglePlayerIntro } from "@/components/single-player-intro";
import { cn } from "@/lib/utils";
import {
  DEFAULT_MAX_PLAYERS,
  DEFAULT_MIN_PLAYERS,
  GAME_PLAYER_LIMITS,
} from "@/lib/game-player-limits";

/** Samma id:n som single player-länkarna i sidomenyn (`app-sidebar` GAME_LINKS), minus Texas Hold'em (egen setup-vy). */
export type GameSinglePlayerIntroId =
  | "fivehoundred"
  | "chicago"
  | "finnsisjon"
  | "skitgubbe";

type IntroCopy = {
  title: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  /** Namn i meningen «Vill du spela … med vänner?» (samma som i sidomenyn) */
  friendsInviteGameName: string;
};

const COPY: Record<GameSinglePlayerIntroId, IntroCopy> = {
  fivehoundred: {
    title: "500 – single player",
    description:
      "Välj antal spelare (2–6). Du spelar som spelare 1, övriga är datorstyrda motståndare.",
    minPlayers: DEFAULT_MIN_PLAYERS,
    maxPlayers: DEFAULT_MAX_PLAYERS,
    friendsInviteGameName: "500",
  },
  chicago: {
    title: "Poker Chicago – single player",
    description:
      "Välj antal spelare (2–6). Du spelar som spelare 1, övriga är datorstyrda motståndare.",
    minPlayers: DEFAULT_MIN_PLAYERS,
    maxPlayers: DEFAULT_MAX_PLAYERS,
    friendsInviteGameName: "Chicago",
  },
  finnsisjon: {
    title: "Finns i sjön – single player",
    description:
      "Välj antal spelare (2–6). Du spelar som spelare 1, övriga är datorer. Fråga efter valör du har – får du inte kortet säger motståndaren 'finns i sjön' och du drar ett kort från sjön. Vinnaren är den med flest kvartetter när alla kort är slut.",
    minPlayers: GAME_PLAYER_LIMITS.finnsisjon.min,
    maxPlayers: GAME_PLAYER_LIMITS.finnsisjon.max,
    friendsInviteGameName: "Finns i sjön",
  },
  skitgubbe: {
    title: "Skitgubbe – single player",
    description:
      "Välj antal spelare (2–6). Du spelar som spelare 1, övriga är datorer.",
    minPlayers: GAME_PLAYER_LIMITS.skitgubbe.min,
    maxPlayers: GAME_PLAYER_LIMITS.skitgubbe.max,
    friendsInviteGameName: "Skitgubbe",
  },
};

function friendsInviteNotePrefix(gameName: string) {
  return `Vill du spela ${gameName} med vänner? Skapa ett spel via`;
}

export function GameSinglePlayerIntro({
  gameId,
  onSelect,
}: {
  gameId: GameSinglePlayerIntroId;
  onSelect: (playerCount: number) => void;
}) {
  const c = COPY[gameId];
  return (
    <SinglePlayerIntro
      title={c.title}
      description={c.description}
      minPlayers={c.minPlayers}
      maxPlayers={c.maxPlayers}
      onSelect={onSelect}
      note={friendsInviteNotePrefix(c.friendsInviteGameName)}
    />
  );
}

/** Samma rad som under spelarvals-introt, för t.ex. Texas Hold'em-inställningar. */
export function FriendsInviteMinaSpelNote({
  gameDisplayName,
  className,
}: {
  gameDisplayName: string;
  className?: string;
}) {
  return (
    <p className={cn("text-muted-foreground text-xs", className)}>
      Vill du spela {gameDisplayName} med vänner? Skapa ett spel via{" "}
      <Link
        href="/spel"
        className="underline underline-offset-4 hover:text-foreground"
      >
        Mina spel
      </Link>
      .
    </p>
  );
}
