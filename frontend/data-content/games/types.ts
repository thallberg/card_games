/**
 * Data för ett kortspel som visas på framsidan och i game-card.
 */
export type GameCardData = {
  id: string;
  title: string;
  description: string;
  /** Sökväg till spelets sida, t.ex. /games/poker */
  path: string;
  /** Kort beskrivning för kortet (valfritt) */
  shortDescription?: string;
};
