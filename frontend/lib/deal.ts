import type { Card } from "@/lib/cards";

type HandSortFn = (cards: Card[]) => Card[];

export function dealHandsFromShuffledDeckStart<K extends string>({
  deck,
  playerIds,
  handSize,
  sortHand,
  startIndex = 0,
}: {
  deck: Card[];
  playerIds: readonly K[];
  handSize: number | ((opts: { numPlayers: number; deckLength: number }) => number);
  sortHand?: HandSortFn;
  /** Varifrån i `deck` vi börjar dealen (0 = längst fram). */
  startIndex?: number;
}): {
  hands: Record<K, Card[]>;
  remainingDeck: Card[];
  effectiveHandSize: number;
} {
  const numPlayers = playerIds.length;
  const requestedHandSize =
    typeof handSize === "function" ? handSize({ numPlayers, deckLength: deck.length }) : handSize;

  const maxPossibleHandSize = numPlayers > 0 ? Math.floor((deck.length - startIndex) / numPlayers) : 0;
  const effectiveHandSize = Math.max(0, Math.min(requestedHandSize, maxPossibleHandSize));

  const hands: Record<K, Card[]> = {} as Record<K, Card[]>;
  for (let i = 0; i < numPlayers; i++) {
    const from = startIndex + i * effectiveHandSize;
    const to = from + effectiveHandSize;
    const hand = deck.slice(from, to);
    hands[playerIds[i]] = sortHand ? sortHand(hand) : hand;
  }

  const dealtCards = effectiveHandSize * numPlayers;
  const remainingDeck = deck.slice(startIndex + dealtCards);

  return { hands, remainingDeck, effectiveHandSize };
}

export function dealCardsFromDeckEndToSeats({
  deck,
  numSeats,
  cardsPerSeat,
  seatIsDealt = () => true,
}: {
  deck: Card[];
  numSeats: number;
  cardsPerSeat: number;
  /** Return true om vi ska ge kort till denna seat i ordning (utan att förbruka kort om false). */
  seatIsDealt?: (seatIndex: number) => boolean;
}): {
  hands: Card[][];
  remainingDeck: Card[];
} {
  const remaining = [...deck];
  const hands: Card[][] = Array.from({ length: numSeats }, () => []);

  for (let seatIndex = 0; seatIndex < numSeats; seatIndex++) {
    if (!seatIsDealt(seatIndex)) continue;
    const hand: Card[] = [];
    for (let i = 0; i < cardsPerSeat; i++) {
      const c = remaining.pop();
      if (!c) throw new Error("Not enough cards in deck to deal.");
      hand.push(c);
    }
    hands[seatIndex] = hand;
  }

  return { hands, remainingDeck: remaining };
}

