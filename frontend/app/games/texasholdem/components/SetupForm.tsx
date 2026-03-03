"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PLAYERS, MAX_PLAYERS, MIN_BIG_BLIND, DEFAULT_BUY_IN_BB } from "../constants";
import { getSmallBlind } from "../game-state";

type SetupFormProps = {
  onStart: (numPlayers: number, buyIn: number, bigBlind: number) => void;
};

export function SetupForm({ onStart }: SetupFormProps) {
  const [numPlayers, setNumPlayers] = useState(2);
  const [buyIn, setBuyIn] = useState(2000);
  const [bigBlind, setBigBlind] = useState(20);

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
              value={numPlayers}
              onChange={(e) => setNumPlayers(Number(e.target.value) || 2)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="buyin">Pengar hög (buy-in) per spelare</Label>
            <Input
              id="buyin"
              type="number"
              min={1}
              value={buyIn}
              onChange={(e) => setBuyIn(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bigblind">Big blind</Label>
            <Input
              id="bigblind"
              type="number"
              min={MIN_BIG_BLIND}
              value={bigBlind}
              onChange={(e) => setBigBlind(Number(e.target.value) || 1)}
            />
            <p className="text-muted-foreground text-sm">
              Small blind blir automatiskt hälften: {smallBlind}
            </p>
          </div>
          <Button type="submit" className="w-full">
            Starta spelet
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
