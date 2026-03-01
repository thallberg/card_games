"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Card } from "../types";
import { PlayingCard } from "./PlayingCard";

type CardActionModalProps = {
  card: Card;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
  onLayMeld: () => void;
};

export function CardActionModal({
  card,
  open,
  onOpenChange,
  onDiscard,
  onLayMeld,
}: CardActionModalProps) {
  const handleDiscard = () => {
    onDiscard();
    onOpenChange(false);
  };

  const handleLayMeld = () => {
    onOpenChange(false);
    onLayMeld();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Vad vill du göra med kortet?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <PlayingCard card={card} faceUp className="h-[100px] w-[70px]" />
          <div className="flex w-full gap-2">
            <Button variant="outline" className="flex-1" onClick={handleDiscard}>
              Kasta
            </Button>
            <Button className="flex-1" onClick={handleLayMeld}>
              Lägg ut som kombination
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Avbryt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
