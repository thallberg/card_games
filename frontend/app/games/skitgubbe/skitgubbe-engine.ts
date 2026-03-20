import type { Card, PlayerId, Rank } from "./types";
import type { GameState } from "./game-state";
import { getStickWinner } from "./game-state";
import { sortHand, sortHandForPlay } from "./deck";
import { RANK_VALUE } from "./types";
import { highestRank } from "./skitgubbe-trick-logic";

const HUMAN_PLAYER: PlayerId = "p1";

export function applyTrickCards(
  s: GameState,
  playerId: PlayerId,
  cards: Card[],
  handIndices: number[]
): GameState {
  const indexSet = new Set(handIndices);
  const hand = s.playerHands[playerId].filter((_, i) => !indexSet.has(i));
  const newHands = { ...s.playerHands, [playerId]: sortHandForPlay(hand, s.trumpSuit) };
  const newTrickCards = cards.map((card) => ({ playerId, card }));
  const tableTrick = [...s.tableTrick, ...newTrickCards];

  const fighters = s.trickFighters ?? [];
  if (fighters.length > 0) {
    if (!fighters.includes(playerId) || cards.length !== 1) return s;
    const startIdx = s.trickFightStartIndex ?? 0;
    const fightCards = tableTrick.slice(startIdx);
    if (fightCards.length < fighters.length) {
      const nextFighter = getNextTrickFighter(s.playerIds, playerId, fighters, fightCards);
      return { ...s, playerHands: newHands, tableTrick, currentPlayerId: nextFighter ?? playerId };
    }
    const leadSuitFight = fightCards[0].card.suit;
    let trickWinner = fightCards[0].playerId;
    let bestCard = fightCards[0].card;
    for (const tc of fightCards.slice(1)) {
      const beats =
        (tc.card.suit === s.trumpSuit && bestCard.suit !== s.trumpSuit) ||
        (tc.card.suit === s.trumpSuit &&
          bestCard.suit === s.trumpSuit &&
          RANK_VALUE[tc.card.rank] > RANK_VALUE[bestCard.rank]) ||
        (tc.card.suit === leadSuitFight &&
          bestCard.suit !== s.trumpSuit &&
          RANK_VALUE[tc.card.rank] > RANK_VALUE[bestCard.rank]);
      if (beats) {
        trickWinner = tc.playerId;
        bestCard = tc.card;
      }
    }
    return {
      ...s,
      playerHands: newHands,
      tableTrick,
      trickLeader: trickWinner,
      trickLeadLength: 0,
      trickPlayLengths: [],
      trickLeadSuit: null,
      trickHighRank: null,
      trumpPlayedInTrick: false,
      trickFighters: [],
      trickFightStartIndex: 0,
      currentPlayerId: trickWinner,
      trickShowingWinner: trickWinner,
    };
  }

  if (hand.length === 0) {
    return {
      ...s,
      playerHands: newHands,
      tableTrick: [],
      trickLeader: null,
      trickLeadLength: 0,
      trickPlayLengths: [],
      trickLeadSuit: null,
      trickHighRank: null,
      trumpPlayedInTrick: false,
      trickFighters: [],
      trickFightStartIndex: 0,
      phase: "gameOver",
      winnerId: playerId,
    };
  }

  const isLead = s.trickLeadSuit === null;
  const trickPlayLengths = isLead ? [cards.length] : [...(s.trickPlayLengths ?? []), cards.length];
  const trumpPlayed = s.trumpPlayedInTrick || cards.every((c) => c.suit === s.trumpSuit);
  const effectiveSuit =
    trumpPlayed && tableTrick.some((tc) => tc.card.suit === s.trumpSuit)
      ? s.trumpSuit!
      : (tableTrick[0]?.card.suit ?? cards[0].suit);
  const cardsInSuit = tableTrick.filter((tc) => tc.card.suit === effectiveSuit);
  const highRank: Rank =
    cardsInSuit.length > 0
      ? cardsInSuit.reduce(
          (best, tc) => (RANK_VALUE[tc.card.rank] > RANK_VALUE[best] ? tc.card.rank : best),
          cardsInSuit[0].card.rank
        )
      : highestRank(cards);

  const allPlayed = trickPlayLengths.length >= s.numPlayers;
  if (!allPlayed) {
    const nextPlayer = getNextInOrder(s.playerIds, playerId);
    return {
      ...s,
      playerHands: newHands,
      tableTrick,
      trickLeader: s.trickLeader,
      trickLeadLength: isLead ? cards.length : s.trickLeadLength,
      trickPlayLengths,
      trickLeadSuit: effectiveSuit,
      trickHighRank: highRank,
      trumpPlayedInTrick: trumpPlayed,
      currentPlayerId: nextPlayer,
    };
  }

  const leadSuit = tableTrick[0].card.suit;
  const beats = (a: Card, b: Card) =>
    (a.suit === s.trumpSuit && b.suit !== s.trumpSuit) ||
    (a.suit === s.trumpSuit && b.suit === s.trumpSuit && RANK_VALUE[a.rank] > RANK_VALUE[b.rank]) ||
    (a.suit === leadSuit && b.suit !== s.trumpSuit && RANK_VALUE[a.rank] > RANK_VALUE[b.rank]);
  const ties = (a: Card, b: Card) => !beats(a, b) && !beats(b, a);

  let trickWinner = tableTrick[0].playerId;
  let bestCard = tableTrick[0].card;
  let offset = 0;
  for (const playLen of trickPlayLengths) {
    const playCards = tableTrick.slice(offset, offset + playLen);
    offset += playLen;
    const playBest = playCards.reduce<{ playerId: PlayerId; card: Card } | null>((best, tc) => {
      if (!best) return { playerId: tc.playerId, card: tc.card };
      if (tc.card.suit === s.trumpSuit && best.card.suit !== s.trumpSuit) return { playerId: tc.playerId, card: tc.card };
      if (tc.card.suit === s.trumpSuit && best.card.suit === s.trumpSuit) {
        return RANK_VALUE[tc.card.rank] > RANK_VALUE[best.card.rank] ? { playerId: tc.playerId, card: tc.card } : best;
      }
      if (tc.card.suit === leadSuit && best.card.suit !== s.trumpSuit) {
        return RANK_VALUE[tc.card.rank] > RANK_VALUE[best.card.rank] ? { playerId: tc.playerId, card: tc.card } : best;
      }
      return best;
    }, null);
    if (playBest && beats(playBest.card, bestCard)) {
      trickWinner = playBest.playerId;
      bestCard = playBest.card;
    }
  }

  const tiedFighters: PlayerId[] = [];
  offset = 0;
  for (const playLen of trickPlayLengths) {
    const playCards = tableTrick.slice(offset, offset + playLen);
    offset += playLen;
    const playBest = playCards.reduce<{ playerId: PlayerId; card: Card } | null>((best, tc) => {
      if (!best) return { playerId: tc.playerId, card: tc.card };
      if (tc.card.suit === s.trumpSuit && best.card.suit !== s.trumpSuit) return { playerId: tc.playerId, card: tc.card };
      if (tc.card.suit === s.trumpSuit && best.card.suit === s.trumpSuit) {
        return RANK_VALUE[tc.card.rank] > RANK_VALUE[best.card.rank] ? { playerId: tc.playerId, card: tc.card } : best;
      }
      if (tc.card.suit === leadSuit && best.card.suit !== s.trumpSuit) {
        return RANK_VALUE[tc.card.rank] > RANK_VALUE[best.card.rank] ? { playerId: tc.playerId, card: tc.card } : best;
      }
      return best;
    }, null);
    if (playBest && ties(playBest.card, bestCard)) tiedFighters.push(playBest.playerId);
  }

  if (tiedFighters.length > 1) {
    const firstFighter = getFirstFighterAfter(s.playerIds, playerId, tiedFighters);
    return {
      ...s,
      playerHands: newHands,
      tableTrick,
      trickFighters: tiedFighters,
      trickFightStartIndex: tableTrick.length,
      currentPlayerId: firstFighter,
    };
  }

  return {
    ...s,
    playerHands: newHands,
    tableTrick,
    trickLeader: trickWinner,
    trickLeadLength: 0,
    trickPlayLengths: [],
    trickLeadSuit: null,
    trickHighRank: null,
    trumpPlayedInTrick: false,
    currentPlayerId: trickWinner,
    trickShowingWinner: trickWinner,
  };
}

export function applyTrickCard(s: GameState, playerId: PlayerId, card: Card, handIndex: number): GameState {
  return applyTrickCards(s, playerId, [card], [handIndex]);
}

export function getNextInOrder(playerIds: PlayerId[], current: PlayerId): PlayerId {
  const i = playerIds.indexOf(current);
  return playerIds[(i + 1) % playerIds.length];
}

function getFirstFighterAfter(playerIds: PlayerId[], after: PlayerId, fighters: PlayerId[]): PlayerId {
  let next = getNextInOrder(playerIds, after);
  for (let n = 0; n < playerIds.length; n++) {
    if (fighters.includes(next)) return next;
    next = getNextInOrder(playerIds, next);
  }
  return fighters[0];
}

function getNextTrickFighter(
  playerIds: PlayerId[],
  lastPlayer: PlayerId,
  fighters: PlayerId[],
  fightCards: { playerId: PlayerId }[]
): PlayerId | null {
  const played = new Set(fightCards.map((tc) => tc.playerId));
  let next = getNextInOrder(playerIds, lastPlayer);
  for (let n = 0; n < playerIds.length; n++) {
    if (fighters.includes(next) && !played.has(next)) return next;
    next = getNextInOrder(playerIds, next);
  }
  return null;
}

function getToBeatFromTrick(
  trick: { playerId: PlayerId; card: Card }[],
  trumpSuit: Card["suit"] | null
): { leaderId: PlayerId; effectiveSuit: Card["suit"]; highRank: Rank } | null {
  if (trick.length === 0) return null;
  const leadSuit = trick[0].card.suit;
  const trumpOnTable = trick.filter((tc) => tc.card.suit === trumpSuit);
  let bestPlayer = trick[0].playerId;
  let bestCard = trick[0].card;
  for (const tc of trick) {
    if (tc.card.suit === trumpSuit && bestCard.suit !== trumpSuit) {
      bestPlayer = tc.playerId;
      bestCard = tc.card;
    } else if (tc.card.suit === trumpSuit && bestCard.suit === trumpSuit) {
      if (RANK_VALUE[tc.card.rank] > RANK_VALUE[bestCard.rank]) {
        bestPlayer = tc.playerId;
        bestCard = tc.card;
      }
    } else if (tc.card.suit === leadSuit && bestCard.suit !== trumpSuit) {
      if (RANK_VALUE[tc.card.rank] > RANK_VALUE[bestCard.rank]) {
        bestPlayer = tc.playerId;
        bestCard = tc.card;
      }
    }
  }
  const effectiveSuit = trumpOnTable.length > 0 ? trumpSuit! : leadSuit;
  const leadSuitCards = trick.filter((tc) => tc.card.suit === effectiveSuit);
  const highRank = leadSuitCards.reduce<Rank>(
    (best, tc) => (RANK_VALUE[tc.card.rank] > RANK_VALUE[best] ? tc.card.rank : best),
    leadSuitCards[0].card.rank
  );
  return { leaderId: bestPlayer, effectiveSuit, highRank };
}

export function applyPickUpTrick(s: GameState, playerId: PlayerId): GameState {
  const tableTrick = s.tableTrick ?? [];
  const leader = s.trickLeader;
  const playLengths = s.trickPlayLengths ?? [];
  const leadLen = playLengths[0] ?? (s.trickLeadLength || 1);
  if (tableTrick.length === 0 || !leader) return s;

  const leadersCards = tableTrick.slice(0, leadLen);
  const remaining = tableTrick.slice(leadLen);
  const remainingLengths = playLengths.slice(1);
  const pickedUp = leadersCards.map((tc) => tc.card);
  const currentHand = s.playerHands[playerId] ?? [];
  const newHand = sortHandForPlay([...currentHand, ...pickedUp], s.trumpSuit);
  const nextPlayer = getNextInOrder(s.playerIds, playerId);

  if (remaining.length === 0) {
    return {
      ...s,
      playerHands: { ...s.playerHands, [playerId]: newHand },
      tableTrick: [],
      trickLeader: null,
      trickLeadLength: 0,
      trickPlayLengths: [],
      trickLeadSuit: null,
      trickHighRank: null,
      trumpPlayedInTrick: false,
      trickFighters: [],
      trickFightStartIndex: 0,
      currentPlayerId: nextPlayer,
      trickPickUpBy: playerId,
    };
  }

  const toBeat = getToBeatFromTrick(remaining, s.trumpSuit);
  if (!toBeat) return s;
  return {
    ...s,
    playerHands: { ...s.playerHands, [playerId]: newHand },
    tableTrick: remaining,
    trickLeader: toBeat.leaderId,
    trickLeadLength: s.trickLeadLength,
    trickPlayLengths: remainingLengths,
    trickLeadSuit: toBeat.effectiveSuit,
    trickHighRank: toBeat.highRank,
    trumpPlayedInTrick: remaining.some((tc) => tc.card.suit === s.trumpSuit),
    trickFighters: [],
    trickFightStartIndex: 0,
    currentPlayerId: nextPlayer,
    trickPickUpBy: playerId,
  };
}

export function applyPlayCard(
  s: GameState,
  playerId: PlayerId,
  card: Card,
  handIndex: number,
  newStock?: Card[]
): GameState {
  const stock = newStock ?? s.stock;
  let hands = { ...s.playerHands };

  if (handIndex >= 0) {
    const hand = hands[playerId].filter((_, i) => i !== handIndex);
    hands = { ...hands, [playerId]: sortHand(hand) };
  }

  const tableStick = [...s.tableStick, { playerId, card }];
  const isFighterPlaying = s.stickFighters.includes(playerId);
  const ledRank = isFighterPlaying ? card.rank : (s.stickLedRank ?? card.rank);
  const playersMustPlay = s.playersMustPlay.filter((id) => id !== playerId);

  const othersWithRank = isFighterPlaying
    ? s.stickFighters.filter((id) => id !== playerId && hands[id]?.some((c) => c.rank === ledRank))
    : s.playerIds.filter(
        (id) =>
          id !== playerId &&
          hands[id]?.some((c) => c.rank === ledRank) &&
          !tableStick.some((sc) => sc.playerId === id)
      );

  const allWithRankPlayed =
    playersMustPlay.length === 0 &&
    s.playerIds.every((id) => {
      if (hands[id]?.some((c) => c.rank === ledRank)) return tableStick.some((sc) => sc.playerId === id);
      return true;
    });

  const playersWhoHaventPlayed = s.playerIds.filter((id) => !tableStick.some((sc) => sc.playerId === id));
  const originalLedRank = tableStick.length > 0 ? tableStick[0].card.rank : ledRank;
  const highestRankOnTable: Rank | null =
    tableStick.length > 0
      ? (tableStick.reduce(
          (best, sc) => (RANK_VALUE[sc.card.rank] > RANK_VALUE[best] ? sc.card.rank : best),
          tableStick[0].card.rank
        ) as Rank)
      : null;
  const fightersFromTable =
    highestRankOnTable != null
      ? [...new Set(tableStick.filter((sc) => sc.card.rank === highestRankOnTable).map((sc) => sc.playerId))]
      : [];
  const fightTieRank = highestRankOnTable;

  const doDrawForHuman = () => {
    if (playerId === HUMAN_PLAYER && handIndex >= 0 && stock.length > 0) {
      const c = stock[stock.length - 1];
      return {
        finalStock: stock.slice(0, -1),
        finalHands: { ...hands, [HUMAN_PLAYER]: sortHand([...(hands[HUMAN_PLAYER] ?? []), c]) },
      };
    }
    return { finalStock: stock, finalHands: hands };
  };

  if (!allWithRankPlayed && othersWithRank.length > 0) {
    const { finalStock, finalHands } = doDrawForHuman();
    return {
      ...s,
      stock: finalStock,
      playerHands: finalHands,
      tableStick,
      stickLedRank: ledRank,
      playersMustPlay: [...playersMustPlay, ...othersWithRank],
      stickFighters: isFighterPlaying ? s.stickFighters : [],
      currentPlayerId: othersWithRank[0],
      humanPendingKlar: false,
      nextPlayerIdAfterKlar: null,
    };
  }

  const someonePlayedHigher =
    originalLedRank && tableStick.some((sc) => RANK_VALUE[sc.card.rank] > RANK_VALUE[originalLedRank]);

  if (isFighterPlaying && s.stickFighters.length > 1 && othersWithRank.length === 0) {
    const otherFighter = s.stickFighters.find(
      (id) => id !== playerId && tableStick.filter((sc) => sc.playerId === id).length === 1
    );
    if (otherFighter) {
      const { finalStock, finalHands } = doDrawForHuman();
      return {
        ...s,
        stock: finalStock,
        playerHands: finalHands,
        tableStick,
        stickLedRank: ledRank,
        playersMustPlay: [],
        stickFighters: s.stickFighters,
        currentPlayerId: otherFighter,
        humanPendingKlar: false,
        nextPlayerIdAfterKlar: null,
      };
    }
  }

  if (playersWhoHaventPlayed.length === 0 && fightersFromTable.length > 1 && fightTieRank != null) {
    const allFightersPlayed = fightersFromTable.every((fid) => {
      const cards = tableStick.filter((sc) => sc.playerId === fid);
      if (cards.length < 2) return false;
      const lastCard = cards[cards.length - 1];
      return lastCard.card.rank !== fightTieRank;
    });
    if (!allFightersPlayed) {
      const needsFightCard = (fid: PlayerId) => {
        const cards = tableStick.filter((sc) => sc.playerId === fid);
        return cards.length >= 1 && cards[cards.length - 1].card.rank === fightTieRank;
      };
      const nextFighter =
        fightersFromTable.find(needsFightCard) ??
        fightersFromTable.reduce((a, b) =>
          tableStick.findIndex((sc) => sc.playerId === a && sc.card.rank === fightTieRank) <
          tableStick.findIndex((sc) => sc.playerId === b && sc.card.rank === fightTieRank)
            ? a
            : b
        );
      if (nextFighter) {
        const { finalStock, finalHands } = doDrawForHuman();
        return {
          ...s,
          stock: finalStock,
          playerHands: finalHands,
          tableStick,
          stickLedRank: fightTieRank,
          playersMustPlay: [],
          stickFighters: fightersFromTable,
          currentPlayerId: nextFighter,
          humanPendingKlar: false,
          nextPlayerIdAfterKlar: null,
        };
      }
    }
  }

  if (playersWhoHaventPlayed.length > 0) {
    const leader = tableStick[0].playerId;
    let nextId: PlayerId | null = null;
    for (let i = 1; i <= s.playerIds.length; i++) {
      const candidate = s.playerIds[(s.playerIds.indexOf(leader) + i) % s.playerIds.length];
      if (playersWhoHaventPlayed.includes(candidate)) {
        nextId = candidate;
        break;
      }
    }
    if (nextId) {
      const { finalStock, finalHands } = doDrawForHuman();
      return {
        ...s,
        stock: finalStock,
        playerHands: finalHands,
        tableStick,
        stickLedRank: ledRank,
        playersMustPlay: [],
        stickFighters: [],
        currentPlayerId: nextId,
        humanPendingKlar: false,
        nextPlayerIdAfterKlar: null,
      };
    }
  }

  if (someonePlayedHigher) {
    const winner = getStickWinner(tableStick, highestRankOnTable ?? originalLedRank);
    const { finalStock, finalHands } = doDrawForHuman();
    return {
      ...s,
      stock: finalStock,
      playerHands: finalHands,
      tableStick,
      stickLedRank: null,
      playersMustPlay: [],
      stickFighters: [],
      currentPlayerId: winner,
      stickShowingWinner: winner,
      humanPendingKlar: false,
      nextPlayerIdAfterKlar: null,
    };
  }

  const fighters = fightersFromTable;
  if (fighters.length > 1 && fightTieRank != null) {
    const allFightersPlayed = fighters.every((fid) => {
      const cards = tableStick.filter((sc) => sc.playerId === fid);
      if (cards.length < 2) return false;
      const lastCard = cards[cards.length - 1];
      return lastCard.card.rank !== fightTieRank;
    });
    if (!allFightersPlayed) {
      const needsFightCard = (fid: PlayerId) => {
        const cards = tableStick.filter((sc) => sc.playerId === fid);
        return cards.length >= 1 && cards[cards.length - 1].card.rank === fightTieRank;
      };
      const nextFighter =
        fighters.find(needsFightCard) ??
        fighters.reduce((a, b) =>
          tableStick.findIndex((sc) => sc.playerId === a && sc.card.rank === fightTieRank) <
          tableStick.findIndex((sc) => sc.playerId === b && sc.card.rank === fightTieRank)
            ? a
            : b
        );
      if (nextFighter) {
        const { finalStock, finalHands } = doDrawForHuman();
        return {
          ...s,
          stock: finalStock,
          playerHands: finalHands,
          tableStick,
          stickLedRank: fightTieRank,
          playersMustPlay: [],
          stickFighters: fighters,
          currentPlayerId: nextFighter,
          humanPendingKlar: false,
          nextPlayerIdAfterKlar: null,
        };
      }
    }
  }

  const winner = getStickWinner(
    tableStick,
    fightTieRank ?? originalLedRank ?? tableStick[0]?.card.rank ?? ledRank
  );
  const { finalStock, finalHands } = doDrawForHuman();
  return {
    ...s,
    stock: finalStock,
    playerHands: finalHands,
    tableStick,
    stickLedRank: null,
    playersMustPlay: [],
    stickFighters: [],
    currentPlayerId: winner,
    stickShowingWinner: winner,
    humanPendingKlar: false,
    nextPlayerIdAfterKlar: null,
  };
}

export function getDrawOrder(playerIds: PlayerId[], after: PlayerId): PlayerId[] {
  const i = playerIds.indexOf(after);
  return [...playerIds.slice(i), ...playerIds.slice(0, i)];
}

export function resolveStickWinner(s: GameState): GameState {
  if (s.phase !== "sticks" || !s.stickShowingWinner) return s;
  const w = s.stickShowingWinner;
  const cards = s.tableStick.map((sc) => sc.card);
  const sticksWon = { ...s.sticksWon, [w]: (s.sticksWon[w] ?? 0) + 1 };
  const wonCards = {
    ...(s.wonCards ?? Object.fromEntries(s.playerIds.map((id) => [id, [] as Card[]]))),
    [w]: [...(s.wonCards?.[w] ?? []), ...cards],
  };
  let drawStock = [...s.stock];
  let lastRevealed = s.lastRevealedCard;
  let trumpSuit = s.trumpSuit;
  let lastStickWinner = s.lastStickWinner;
  const drawOrder = getDrawOrder(s.playerIds, w);
  let newHands = { ...s.playerHands };
  for (const id of drawOrder) {
    while (drawStock.length > 0 && (newHands[id]?.length ?? 0) < 3) {
      const c = drawStock.pop()!;
      if (drawStock.length === 0) {
        lastRevealed = c;
        trumpSuit = c.suit;
        lastStickWinner = id;
      } else {
        newHands = { ...newHands, [id]: sortHand([...(newHands[id] ?? []), c]) };
      }
    }
  }
  if (drawStock.length === 1) {
    lastRevealed = drawStock[0];
    trumpSuit = lastRevealed!.suit;
    lastStickWinner = w;
    drawStock = [];
  }
  if (drawStock.length === 0 && lastRevealed && !trumpSuit) trumpSuit = lastRevealed.suit;
  const phase: GameState["phase"] = drawStock.length === 0 ? "skitgubbe" : "sticks";
  const finalHands =
    phase === "skitgubbe" && lastRevealed && lastStickWinner
      ? {
          ...newHands,
          [lastStickWinner]: sortHand([...(newHands[lastStickWinner] ?? []), lastRevealed]),
        }
      : newHands;
  return {
    ...s,
    stock: drawStock,
    playerHands: finalHands,
    tableStick: [],
    stickLedRank: null,
    playersMustPlay: [],
    stickFighters: [],
    sticksWon,
    wonCards,
    stickShowingWinner: null,
    lastRevealedCard: lastRevealed,
    trumpSuit,
    lastStickWinner,
    phase,
    currentPlayerId: w,
  };
}

export function resolveTrickWinner(s: GameState): GameState {
  if (s.phase !== "play" || !s.trickShowingWinner) return s;
  return { ...s, trickShowingWinner: null, tableTrick: [], trickFighters: [], trickFightStartIndex: 0 };
}

