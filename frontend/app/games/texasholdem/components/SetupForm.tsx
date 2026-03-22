"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FriendsInviteMinaSpelNote } from "@/components/game-single-player-intro";
import { MIN_PLAYERS, MAX_PLAYERS, MIN_BIG_BLIND, DEFAULT_BUY_IN_BB } from "../constants";
import { getSmallBlind } from "../game-state";

type SetupFormProps = {
  onStart: (numPlayers: number, buyIn: number, bigBlind: number) => void;
};

export function SetupForm({ onStart }: SetupFormProps) {
  const [numPlayersStr, setNumPlayersStr] = useState("2");
  const [buyInStr, setBuyInStr] = useState("2000");
  const [bigBlindStr, setBigBlindStr] = useState("20");

  const numPlayers = Number(numPlayersStr) || MIN_PLAYERS;
  const buyIn = Number(buyInStr) || 2000;
  const bigBlind = Number(bigBlindStr) || MIN_BIG_BLIND;
  const smallBlind = getSmallBlind(bigBlind);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numPlayers < MIN_PLAYERS || numPlayers > MAX_PLAYERS) return;
    if (buyIn <= 0 || bigBlind <= 0) return;
    if (bigBlind > buyIn) return;
    onStart(numPlayers, buyIn, bigBlind);
  };

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Texas Hold&apos;em – Inställningar</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="players">Antal spelare (2–6)</Label>
            <Input
              id="players"
              type="number"
              min={MIN_PLAYERS}
              max={MAX_PLAYERS}
              value={numPlayersStr}
              onChange={(e) => setNumPlayersStr(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="buyin">Pengar hög (buy-in) per spelare</Label>
            <Input
              id="buyin"
              type="number"
              min={1}
              value={buyInStr}
              onChange={(e) => setBuyInStr(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bigblind">Big blind</Label>
            <Input
              id="bigblind"
              type="number"
              min={MIN_BIG_BLIND}
              value={bigBlindStr}
              onChange={(e) => setBigBlindStr(e.target.value)}
            />
            <p className="text-muted-foreground text-sm">
              Small blind blir automatiskt hälften: {smallBlind}
            </p>
          </div>
          <Button type="submit" variant="outlinePrimary" className="w-full">
            Starta spelet
          </Button>
        </form>
        <FriendsInviteMinaSpelNote
          gameDisplayName="Texas Hold'em"
          className="mt-6 text-muted-foreground text-xs"
        />
      </CardContent>
    </Card>
  );
}
